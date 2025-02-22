package com.testleaf.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.StringEntity;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class LLMTestGenerator {

    @Value("${llm.api.url}")
    private String llmApiUrl;

    @Value("${llm.api.key}")
    private String apiKey;

    @Value("${llm.model}")
    private String modelName;

    /**
     * Generates test cases given API details and a list of test types.
     */
    public String generateTestCases(String apiDetails, List<String> testTypes) {
        if (apiDetails == null || apiDetails.isEmpty()) {
            return "No valid API details to generate test cases.";
        }
        
        // Existing code remains unchanged
        
        return generateTestCasesFromUserStory(apiDetails, testTypes);
    }

    // For backward compatibility: defaults to positive tests if testTypes is not provided.
    public String generateTestCases(String apiDetails) {
        return generateTestCases(apiDetails, new ArrayList<>());
    }

    private String callLLMApi(String requestBody) {
        try (var httpClient = HttpClients.createDefault()) {
            var request = new HttpPost(llmApiUrl);
            request.setHeader("Content-Type", "application/json");
            request.setHeader("Authorization", "Bearer " + apiKey);
            request.setEntity(new StringEntity(requestBody));
            System.out.println(requestBody);

            try (CloseableHttpResponse response = httpClient.execute(request)) {
                return EntityUtils.toString(response.getEntity());
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "Error calling LLM API: " + e.getMessage();
        }
    }

    /**
     * Newly added method to generate test cases based on user stories.
     */
    public String generateTestCasesFromUserStory(String userStory, List<String> testTypes) {
        if (userStory == null || userStory.isEmpty()) {
            return "No valid user story provided.";
        }
        
        String testTypeLine = buildTestTypeInstruction(testTypes);
        
        String userPrompt = "Generate test cases for the following user story:\n" + userStory;

        try {
            List<Map<String, String>> messages = new ArrayList<>();
            
            Map<String, String> systemMessage = new HashMap<>();
            systemMessage.put("role", "system");
            systemMessage.put("content", "You are a test case generation assistant. " + testTypeLine);
            messages.add(systemMessage);
            
            Map<String, String> userMessage = new HashMap<>();
            userMessage.put("role", "user");
            userMessage.put("content", userPrompt);
            messages.add(userMessage);
            
            Map<String, Object> payload = new HashMap<>();
            payload.put("model", modelName);
            payload.put("messages", messages);
            payload.put("temperature", 0.1);
            payload.put("top_p", 0.2);
            payload.put("max_tokens", 1000);
            
            ObjectMapper mapper = new ObjectMapper();
            String requestBody = mapper.writeValueAsString(payload);

            return callLLMApi(requestBody);
        } catch (Exception e) {
            e.printStackTrace();
            return "Error building JSON payload: " + e.getMessage();
        }
    }

    private String buildTestTypeInstruction(List<String> testTypes) {
        if (testTypes == null || testTypes.isEmpty()) {
            return "Include all test case types (Positive, Negative, Edge).";
        }
        return "Include only: " + String.join(", ", testTypes) + " tests.";
    }
}
