package com.testleaf.controller;

import com.testleaf.llm.LLMTestGenerator;
import com.testleaf.llm.TestCodeGenerator;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000")
@RequiredArgsConstructor
public class TestGenerationController {

    private final LLMTestGenerator llmTestGenerator = new LLMTestGenerator();
    private final TestCodeGenerator testCodeGenerator = new TestCodeGenerator();

    /**
     * Generates Rest-Assured test code from the provided API details and test types.
     *
     * Example usage:
     *  POST /api/generateTests
     *  Body (raw JSON):
     *  {
     *    "apiDetails": "Path: /pet, Method: PUT, Summary: Update an existing pet\nPath: ...",
     *    "testTypes": ["positive", "negative"]
     *  }
     */
    @PostMapping("/generateTests")
    public ResponseEntity<String> generateTests(@RequestBody ApiDetailsRequest request) {
        try {
            // Generate code using the LLM, passing both apiDetails and testTypes
            String llmResponse = llmTestGenerator.generateTestCases(
                    request.getApiDetails(),
                    request.getTestTypes()
            );

            // Extract final Java code
            String finalCode = testCodeGenerator.extractJavaCode(llmResponse);

            // Return the code as plain text
            return ResponseEntity.ok(finalCode);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error generating test code: " + e.getMessage());
        }
    }

    /**
     * Generates test cases based on a user story input (text or file) and test case types.
     *
     * Example usage:
     *  POST /api/generateTestCases
     *  Form Data:
     *    - text: "User story description..." (optional)
     *    - file: (User story file) (optional)
     *    - testTypes: ["positive", "negative", "edge"]
     */
    @PostMapping("/generateTestCases") // Newly added API endpoint
    public ResponseEntity<?> generateTestCases(
            @RequestParam(value = "text", required = false) String userStoryText,
            @RequestParam(value = "file", required = false) MultipartFile userStoryFile,
            @RequestParam("testTypes") List<String> testTypes) {
        
        try {
            if (userStoryText == null && userStoryFile == null) {
                return ResponseEntity.badRequest().body("User story text or file is required.");
            }

            // Read file content if provided // Newly added logic
            if (userStoryFile != null) {
                userStoryText = new String(userStoryFile.getBytes(), StandardCharsets.UTF_8);
            }

            // Generate test cases using LLM // Newly added logic
            String generatedTestCases = llmTestGenerator.generateTestCases(userStoryText, testTypes);
            
            return ResponseEntity.ok(Map.of("testCases", generatedTestCases));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Error processing the file: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error generating test cases: " + e.getMessage());
        }
    }

    // Updated DTO with field "testTypes" (plural) to match the React payload.
    public static class ApiDetailsRequest {
        private String apiDetails;
        private List<String> testTypes;  // Updated field name

        public String getApiDetails() {
            return apiDetails;
        }
        public void setApiDetails(String apiDetails) {
            this.apiDetails = apiDetails;
        }

        public List<String> getTestTypes() {
            return testTypes;
        }
        public void setTestTypes(List<String> testTypes) {
            this.testTypes = testTypes;
        }
    }
}
