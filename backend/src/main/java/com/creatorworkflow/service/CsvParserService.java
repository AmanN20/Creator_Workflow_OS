package com.creatorworkflow.service;

import com.creatorworkflow.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CsvParserService {

    /**
     * Parses a YouTube Studio CSV export and returns structured data.
     * Manual parsing to avoid external dependency issues at runtime.
     */
    public Map<String, Object> parseCsv(MultipartFile file) {
        if (file.isEmpty()) {
            throw new BadRequestException("CSV file is empty");
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            List<String> lines = reader.lines().collect(Collectors.toList());
            if (lines.isEmpty()) {
                throw new BadRequestException("CSV file has no data");
            }

            // Headers
            String[] headers = parseCsvLine(lines.get(0));
            Map<String, Integer> headerIndex = new HashMap<>();
            for (int i = 0; i < headers.length; i++) {
                headerIndex.put(headers[i].trim().toLowerCase().replace("\uFEFF", ""), i);
            }

            // Data rows
            List<Map<String, String>> videos = new ArrayList<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] values = parseCsvLine(lines.get(i));
                Map<String, String> video = new HashMap<>();
                for (Map.Entry<String, Integer> entry : headerIndex.entrySet()) {
                    if (entry.getValue() < values.length) {
                        video.put(entry.getKey(), values[entry.getValue()].trim());
                    }
                }
                videos.add(video);
            }

            // Columns detection
            String titleCol = findColumn(headerIndex, "video title", "title");
            String viewsCol = findColumn(headerIndex, "views", "video views", "total views");
            String ctrCol = findColumn(headerIndex, "impressions click-through rate (%)", "ctr", "click-through rate");
            String watchTimeCol = findColumn(headerIndex, "watch time (hours)", "watch time");
            // Detect explicit video ID column
            String videoIdCol = findColumn(headerIndex, "video id", "videoid", "video_id", "content");
            // Auto-detect: check if any unmapped column has YouTube-ID-shaped values (11 chars, alphanumeric+-_)
            if (videoIdCol == null && !videos.isEmpty()) {
                for (Map.Entry<String, Integer> entry : headerIndex.entrySet()) {
                    String col = entry.getKey();
                    if (col.equals(titleCol) || col.equals(viewsCol) || col.equals(ctrCol) || col.equals(watchTimeCol)) continue;
                    boolean looksLikeIds = true;
                    int checked = 0;
                    for (Map<String, String> v : videos) {
                        String val = v.getOrDefault(col, "").trim();
                        if (val.isEmpty()) continue;
                        if (!val.matches("[A-Za-z0-9_-]{10,12}")) { looksLikeIds = false; break; }
                        checked++;
                    }
                    if (looksLikeIds && checked > 0) { videoIdCol = col; break; }
                }
            }

            // Filter out the 'Totals' row (which has no title or says 'Total') and empty trailing rows
            if (titleCol != null) {
                videos.removeIf(video -> {
                    String t = video.getOrDefault(titleCol, "").trim();
                    return t.isEmpty() || t.equalsIgnoreCase("total");
                });
            }

            Map<String, Object> result = new HashMap<>();
            result.put("totalVideos", videos.size());
            result.put("allVideos", videos);
            result.put("videoIdCol", videoIdCol);

            // Top performers
            if (viewsCol != null) {
                String finalViewsCol = viewsCol;
                result.put("topPerformers", videos.stream()
                    .sorted((a, b) -> Double.compare(parseNumber(b.get(finalViewsCol)), parseNumber(a.get(finalViewsCol))))
                    .limit(5).collect(Collectors.toList()));
            }

            // Low CTR
            if (ctrCol != null) {
                String finalCtrCol = ctrCol;
                double avgCtr = videos.stream().mapToDouble(v -> parseNumber(v.get(finalCtrCol))).filter(d -> d > 0).average().orElse(0);
                result.put("lowCtrVideos", videos.stream()
                    .filter(v -> parseNumber(v.get(finalCtrCol)) > 0 && parseNumber(v.get(finalCtrCol)) < avgCtr)
                    .limit(5).collect(Collectors.toList()));
                result.put("averageCtr", String.format("%.2f", avgCtr));
            }

            // High Retention
            if (watchTimeCol != null && viewsCol != null) {
                String finalWatch = watchTimeCol;
                String finalView = viewsCol;
                result.put("highRetention", videos.stream()
                    .filter(v -> parseNumber(v.get(finalView)) > 0)
                    .sorted((a, b) -> Double.compare(
                        parseNumber(b.get(finalWatch)) / Math.max(1, parseNumber(b.get(finalView))),
                        parseNumber(a.get(finalWatch)) / Math.max(1, parseNumber(a.get(finalView)))))
                    .limit(5).collect(Collectors.toList()));
            }

            result.put("summary", buildSummary(result));
            return result;

        } catch (IOException e) {
            throw new BadRequestException("Failed to read CSV: " + e.getMessage());
        }
    }

    private String[] parseCsvLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (char c : line.toCharArray()) {
            if (c == '\"') inQuotes = !inQuotes;
            else if (c == ',' && !inQuotes) {
                result.add(current.toString().trim().replaceAll("^\"|\"$", ""));
                current = new StringBuilder();
            } else current.append(c);
        }
        result.add(current.toString().trim().replaceAll("^\"|\"$", ""));
        return result.toArray(new String[0]);
    }

    private String findColumn(Map<String, Integer> headerIndex, String... aliases) {
        for (String alias : aliases) {
            if (headerIndex.containsKey(alias)) return alias;
            for (String h : headerIndex.keySet()) if (h.contains(alias)) return h;
        }
        return null;
    }

    private double parseNumber(String val) {
        if (val == null) return 0;
        try { return Double.parseDouble(val.replaceAll("[,%]", "").trim()); }
        catch (NumberFormatException e) { return 0; }
    }

    @SuppressWarnings("unchecked")
    private String buildSummary(Map<String, Object> data) {
        List<Map<String, String>> videos = (List<Map<String, String>>) data.get("allVideos");
        StringBuilder sb = new StringBuilder();

        sb.append("=== YouTube Channel Analytics Summary ===\n");
        sb.append("Total Videos Analyzed: ").append(videos.size()).append("\n\n");

        // Detect key column names
        Set<String> allKeys = new HashSet<>();
        for (Map<String, String> v : videos) allKeys.addAll(v.keySet());

        String titleCol = findColumn(toIndexMap(allKeys), "video title", "title");
        String viewsCol = findColumn(toIndexMap(allKeys), "views", "video views", "total views");
        String ctrCol   = findColumn(toIndexMap(allKeys), "impressions click-through rate (%)", "ctr", "click-through rate");
        String watchCol = findColumn(toIndexMap(allKeys), "watch time (hours)", "watch time");
        String subsCol  = findColumn(toIndexMap(allKeys), "subscribers", "subscribers gained");
        String likesCol = findColumn(toIndexMap(allKeys), "likes", "likes (vs. dislikes)");
        String impressCol = findColumn(toIndexMap(allKeys), "impressions");
        String avgViewDur = findColumn(toIndexMap(allKeys), "average view duration", "avg. view duration");
        String videoIdCol = (String) data.get("videoIdCol");

        // Compute aggregates
        double totalViews = 0, totalWatchTime = 0, totalCtr = 0;
        int ctrCount = 0;
        for (Map<String, String> v : videos) {
            if (viewsCol != null) totalViews += parseNumber(v.get(viewsCol));
            if (watchCol != null) totalWatchTime += parseNumber(v.get(watchCol));
            if (ctrCol != null && parseNumber(v.get(ctrCol)) > 0) {
                totalCtr += parseNumber(v.get(ctrCol));
                ctrCount++;
            }
        }
        sb.append("--- Aggregate Stats ---\n");
        if (viewsCol != null) sb.append("Total Views: ").append(String.format("%.0f", totalViews)).append("\n");
        if (watchCol != null) sb.append("Total Watch Time (hours): ").append(String.format("%.1f", totalWatchTime)).append("\n");
        if (ctrCount > 0) sb.append("Average CTR: ").append(String.format("%.2f%%", totalCtr / ctrCount)).append("\n");
        sb.append("\n");

        // Sort by views descending — send top 10 and bottom 5
        List<Map<String, String>> sorted = new ArrayList<>(videos);
        if (viewsCol != null) {
            String vc = viewsCol;
            sorted.sort((a, b) -> Double.compare(parseNumber(b.get(vc)), parseNumber(a.get(vc))));
        }

        sb.append("--- All Videos Data ---\n");
        sb.append("Format: Title | Views | CTR | Watch Time | Avg Duration | Likes\n\n");
        
        for (int i = 0; i < sorted.size(); i++) {
            appendVideoLine(sb, sorted.get(i), i + 1, titleCol, viewsCol, ctrCol, watchCol, avgViewDur, likesCol, videoIdCol);
        }

        return sb.toString();
    }

    private void appendVideoLine(StringBuilder sb, Map<String, String> video, int rank,
                                  String titleCol, String viewsCol, String ctrCol,
                                  String watchCol, String avgViewDur, String likesCol, String videoIdCol) {
        sb.append(rank).append(". ");
        if (videoIdCol != null) sb.append("[ID:").append(video.getOrDefault(videoIdCol, "").trim()).append("] ");
        if (titleCol != null) sb.append("\"").append(video.getOrDefault(titleCol, "N/A")).append("\"");
        if (viewsCol != null) sb.append(" | Views: ").append(video.getOrDefault(viewsCol, "0"));
        if (ctrCol != null)   sb.append(" | CTR: ").append(video.getOrDefault(ctrCol, "0")).append("%");
        if (watchCol != null) sb.append(" | Watch: ").append(video.getOrDefault(watchCol, "0")).append("h");
        if (avgViewDur != null) sb.append(" | AvgDur: ").append(video.getOrDefault(avgViewDur, "N/A"));
        if (likesCol != null) sb.append(" | Likes: ").append(video.getOrDefault(likesCol, "0"));
        sb.append("\n");
    }

    /**
     * Helper: convert a set of column names into a fake header-index map
     * so we can reuse findColumn().
     */
    private Map<String, Integer> toIndexMap(Set<String> keys) {
        Map<String, Integer> map = new HashMap<>();
        int i = 0;
        for (String k : keys) map.put(k, i++);
        return map;
    }
}
