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

            Map<String, Object> result = new HashMap<>();
            result.put("totalVideos", videos.size());
            result.put("allVideos", videos);

            // Columns detection
            String titleCol = findColumn(headerIndex, "video title", "title", "content");
            String viewsCol = findColumn(headerIndex, "views", "video views", "total views");
            String ctrCol = findColumn(headerIndex, "impressions click-through rate (%)", "ctr", "click-through rate");
            String watchTimeCol = findColumn(headerIndex, "watch time (hours)", "watch time");

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
        StringBuilder sb = new StringBuilder("YouTube Channel Analytics Summary:\n");
        sb.append("Total Videos: ").append(data.get("totalVideos")).append("\n\n");
        if (data.containsKey("topPerformers")) {
            sb.append("TOP PERFORMERS:\n");
            List<Map<String, String>> top = (List<Map<String, String>>) data.get("topPerformers");
            for (int i=0; i<top.size(); i++) sb.append(i+1).append(". ").append(top.get(i).getOrDefault("video title", top.get(i).toString())).append("\n");
        }
        return sb.toString();
    }
}
