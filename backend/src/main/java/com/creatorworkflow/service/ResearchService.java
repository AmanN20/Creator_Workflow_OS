package com.creatorworkflow.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ResearchService {

    /* ── Stop words to ignore during keyword extraction ── */
    private static final Set<String> STOP_WORDS = Set.of(
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
        "be", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "shall", "can", "need", "must",
        "not", "no", "so", "if", "then", "than", "too", "very", "just",
        "about", "up", "out", "into", "over", "after", "before", "between",
        "under", "again", "once", "here", "there", "when", "where", "why",
        "how", "all", "each", "every", "both", "few", "more", "most", "other",
        "some", "such", "only", "own", "same", "also", "back", "even", "still",
        "new", "now", "way", "use", "her", "him", "his", "she", "he", "they",
        "them", "we", "us", "you", "your", "my", "our", "its", "what", "which",
        "who", "whom", "these", "those", "am", "been", "being", "because",
        "as", "until", "while", "during", "through", "above", "below",
        "i", "me", "like", "get", "got", "go", "make", "know", "take",
        "come", "think", "look", "want", "give", "say", "tell", "well",
        "one", "two", "three", "first", "thing", "much", "many", "any",
        "really", "right", "going", "actually", "let", "see", "today",
        "start", "something", "people", "guys", "gonna", "don", "doesn",
        "didn", "won", "isn", "aren", "wasn", "weren", "hasn", "haven",
        "re", "ve", "ll", "amp", "nbsp"
    );

    /* Words that are scripting-related noise, not content topics */
    private static final Set<String> SCRIPT_NOISE = Set.of(
        "script", "video", "content", "part", "section", "hook", "body",
        "call", "action", "cta", "intro", "outro", "title", "description",
        "subscribe", "channel", "comment", "like", "share", "watch",
        "click", "link", "below", "thanks", "welcome", "hello", "hey"
    );

    private static final Pattern WORD_PATTERN = Pattern.compile("[a-zA-Z]{3,}");

    /**
     * Main entry point: extract topic → search DuckDuckGo → return structured results.
     */
    public Map<String, Object> research(String scriptText) {
        // Step 1: Clean the text
        String clean = cleanHtml(scriptText);

        // Step 2: Extract meaningful phrases (bigrams + top singles)
        List<String> keywords = extractKeywords(clean);
        List<String> phrases = extractPhrases(clean);

        // Step 3: Build a focused search query
        String topic;
        if (!phrases.isEmpty()) {
            // Use the top phrase as the primary topic
            topic = phrases.get(0);
        } else {
            topic = String.join(" ", keywords.subList(0, Math.min(3, keywords.size())));
        }

        // Build multiple queries for better coverage
        String primaryQuery = "\"" + topic + "\"";
        String broadQuery = String.join(" ", keywords.subList(0, Math.min(4, keywords.size())));

        List<Map<String, String>> allResults = new ArrayList<>();

        // Search with the focused phrase first
        List<Map<String, String>> primaryResults = searchDuckDuckGo(primaryQuery);
        allResults.addAll(primaryResults);

        // If few results, also try broader query
        if (allResults.size() < 6) {
            List<Map<String, String>> broadResults = searchDuckDuckGo(broadQuery);
            // Deduplicate by link
            Set<String> existingLinks = allResults.stream()
                    .map(r -> r.get("link")).collect(Collectors.toSet());
            for (Map<String, String> r : broadResults) {
                if (!existingLinks.contains(r.get("link"))) {
                    allResults.add(r);
                }
            }
        }

        // Categorize results
        List<Map<String, String>> articles = new ArrayList<>();
        List<Map<String, String>> youtube = new ArrayList<>();
        List<Map<String, String>> other = new ArrayList<>();

        for (Map<String, String> r : allResults) {
            String link = r.getOrDefault("link", "").toLowerCase();
            if (link.contains("youtube.com") || link.contains("youtu.be")) {
                youtube.add(r);
            } else if (link.contains("medium.com") || link.contains("dev.to")
                    || link.contains("blog") || link.contains("article")
                    || link.contains("freecodecamp") || link.contains("hashnode")
                    || link.contains("substack") || link.contains("wordpress")) {
                articles.add(r);
            } else {
                other.add(r);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("topic", capitalize(topic));
        response.put("keywords", keywords);
        response.put("searchQuery", primaryQuery);
        response.put("articles", articles);
        response.put("youtube", youtube);
        response.put("guides", other);
        response.put("totalResults", allResults.size());

        return response;
    }

    /**
     * Strip HTML tags and entities.
     */
    private String cleanHtml(String text) {
        return text.replaceAll("<[^>]+>", " ")
                   .replaceAll("&[a-z]+;", " ")
                   .replaceAll("\\s+", " ")
                   .trim();
    }

    /**
     * Extract meaningful 2-3 word phrases that appear multiple times.
     */
    List<String> extractPhrases(String text) {
        String lower = text.toLowerCase();
        String[] words = lower.split("\\s+");

        Map<String, Integer> bigramFreq = new LinkedHashMap<>();
        Map<String, Integer> trigramFreq = new LinkedHashMap<>();

        for (int i = 0; i < words.length - 1; i++) {
            String w1 = words[i].replaceAll("[^a-z]", "");
            String w2 = words[i + 1].replaceAll("[^a-z]", "");

            if (isContentWord(w1) && isContentWord(w2)) {
                String bigram = w1 + " " + w2;
                bigramFreq.merge(bigram, 1, Integer::sum);
            }

            // Trigrams
            if (i < words.length - 2) {
                String w3 = words[i + 2].replaceAll("[^a-z]", "");
                if (isContentWord(w1) && isContentWord(w3)) {
                    // Allow one stop word in the middle for natural phrases
                    String trigram = w1 + " " + w2 + " " + w3;
                    trigramFreq.merge(trigram, 1, Integer::sum);
                }
            }
        }

        // Combine and sort by frequency
        List<String> phrases = new ArrayList<>();

        // Prefer trigrams that appear 2+ times
        trigramFreq.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .forEach(e -> phrases.add(e.getKey()));

        // Then bigrams that appear 2+ times
        bigramFreq.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(5)
                .forEach(e -> {
                    // Don't add if already covered by a trigram
                    boolean covered = phrases.stream().anyMatch(p -> p.contains(e.getKey()));
                    if (!covered) phrases.add(e.getKey());
                });

        return phrases.stream().limit(5).collect(Collectors.toList());
    }

    /**
     * Extract top single keywords by frequency.
     */
    List<String> extractKeywords(String text) {
        String lower = text.toLowerCase();
        Map<String, Integer> freq = new LinkedHashMap<>();

        Matcher matcher = WORD_PATTERN.matcher(lower);
        while (matcher.find()) {
            String word = matcher.group();
            if (isContentWord(word)) {
                freq.merge(word, 1, Integer::sum);
            }
        }

        return freq.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(8)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    /**
     * Returns true if the word is meaningful content (not a stop word or noise).
     */
    private boolean isContentWord(String word) {
        return word.length() >= 3
                && !STOP_WORDS.contains(word)
                && !SCRIPT_NOISE.contains(word);
    }

    /**
     * Scrape DuckDuckGo HTML search results using Jsoup.
     */
    List<Map<String, String>> searchDuckDuckGo(String query) {
        List<Map<String, String>> results = new ArrayList<>();

        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = "https://html.duckduckgo.com/html/?q=" + encoded;

            Document doc = Jsoup.connect(url)
                    .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                    .timeout(12000)
                    .get();

            Elements resultElements = doc.select(".result");

            for (Element el : resultElements) {
                if (results.size() >= 10) break;

                Element titleEl = el.selectFirst(".result__a");
                Element snippetEl = el.selectFirst(".result__snippet");

                if (titleEl == null) continue;

                String title = titleEl.text().trim();
                String link = titleEl.attr("href").trim();
                String snippet = snippetEl != null ? snippetEl.text().trim() : "";

                // DuckDuckGo wraps links through a redirect
                if (link.contains("uddg=")) {
                    try {
                        String decoded = java.net.URLDecoder.decode(
                            link.substring(link.indexOf("uddg=") + 5),
                            StandardCharsets.UTF_8
                        );
                        if (decoded.contains("&")) {
                            decoded = decoded.substring(0, decoded.indexOf("&"));
                        }
                        link = decoded;
                    } catch (Exception ignored) {}
                }

                if (title.isEmpty() || link.isEmpty()) continue;

                // Determine category
                String category = "guide";
                String lowerLink = link.toLowerCase();
                if (lowerLink.contains("youtube.com") || lowerLink.contains("youtu.be")) {
                    category = "video";
                } else if (lowerLink.contains("medium.com") || lowerLink.contains("dev.to")
                        || lowerLink.contains("blog") || lowerLink.contains("hashnode")) {
                    category = "article";
                }

                Map<String, String> item = new LinkedHashMap<>();
                item.put("title", title);
                item.put("link", link);
                item.put("snippet", snippet);
                item.put("category", category);
                item.put("domain", extractDomain(link));
                results.add(item);
            }

        } catch (Exception e) {
            System.err.println("DuckDuckGo scrape failed for query [" + query + "]: " + e.getMessage());
        }

        return results;
    }

    /* ── Helpers ── */

    private String extractDomain(String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String host = uri.getHost();
            if (host != null && host.startsWith("www.")) {
                host = host.substring(4);
            }
            return host != null ? host : url;
        } catch (Exception e) {
            return url;
        }
    }

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Arrays.stream(s.split("\\s+"))
                .map(w -> w.length() > 0 ? w.substring(0, 1).toUpperCase() + w.substring(1) : w)
                .collect(Collectors.joining(" "));
    }
}
