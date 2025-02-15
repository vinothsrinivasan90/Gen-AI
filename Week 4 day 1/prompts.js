/**
 * Collection of default prompts for different use cases
 */
export const DEFAULT_PROMPTS = {
  /**
   * Prompt for generating Playwright test code
   * Variables:
   * - ${domContent}: The DOM content to analyze
   * - ${userAction}: The user action to perform
   * - ${pageUrl}: The page URL to navigate to
   */
  PLAYWRIGHT_CODE_GENERATION: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    Generate Playwright test code in TypeScript to perform the following action:
    \${userAction}

    Here is the page URL:
    \${pageUrl}

    Requirements:
    1. Use only recommended Playwright locators in this priority order:
       - Always use the HTML ids or names if they exist.
       - Do not use id as locator when it has more than a single digit number as value
       - Role-based locators (getByRole)
       - Label-based locators (getByLabel)
       - Text-based locators (getByText)
       - Test ID-based locators (getByTestId)
       - Only use other locators if the above options are not applicable.

    2. Implementation guidelines:
       - Write code using TypeScript with proper type annotations
       - Include appropriate web-first assertions to validate the action
       - Use Playwright's built-in configurations and devices when applicable
       - Store frequently used locators in variables for reuse
       - Avoid hard-coded waits - rely on auto-waiting
       - Include error handling where appropriate
       - Increase the timeout to 90 seconds
       - If scenario involves navigation to a new page, do not assert on that new page's DOM

    3. Code structure:
       - Start with necessary imports
       - Include test description
       - Break down complex actions into smaller steps
       - Use meaningful variable names
       - Follow Playwright's best practices

    4. Performance and reliability:
       - Use built-in auto-waiting
       - Use assertion timeouts rather than arbitrary sleeps
       - Consider retry logic for flaky operations
       - Consider network conditions and page load states

    Respond with only the complete code block and no other text.

    Example:
    \`\`\`typescript
    import { test, expect } from '@playwright/test';
    test('descriptive test name', async ({ page }) => {
      // Implementation
    });
    \`\`\`
  `,

  /**
   * Prompt for generating Selenium Java test code ONLY
   * (No page object class at all).
   */
  SELENIUM_JAVA_TEST_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Selenium Java TEST CLASS using TestNG (no page object class).
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - The elements found using locators should be either one of these tags only : input, button, select, a, div
       - By.id (only if the id doesn’t contain multiple digits like "ext-gen623")
       - By.name
       - By.linkText or partialLinkText for links
       - By.cssSelector (avoid using any attribute containing "genai")
       - By.xpath only if others aren’t suitable
    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use TestNG for assertions
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods
       - Use Javafaker for generating test data
       - No new page object class is needed—pretend we already have it.
       - DO NOT show the PageFactory or any page class reference

    3. Code structure:
       - Show only a single test class
       - @BeforeMethod, @Test, and @AfterMethod
       - Use meaningful method names
       - Use properties file for config if you want
       - Provide only the test class code block, no other text

    Example:
    \`\`\`java
    package com.genai.tests;

    import org.openqa.selenium.WebDriver;
    import org.openqa.selenium.chrome.ChromeDriver;
    import org.openqa.selenium.support.ui.WebDriverWait;
    import org.testng.annotations.*;
    import com.github.javafaker.Faker;
    import java.time.Duration;

    public class ComponentTest {
        private WebDriver driver;
        private WebDriverWait wait;
        private Faker faker;

        @BeforeMethod
        public void setUp() {
            driver = new ChromeDriver();
            wait = new WebDriverWait(driver, Duration.ofSeconds(10));
            faker = new Faker();
            driver.manage().window().maximize();
            driver.get("\${pageUrl}");
        }

        @Test
        public void testComponentAction() {
            // Implementation
        }

        @AfterMethod
        public void tearDown() {
            if (driver != null) {
                driver.quit();
            }
        }
    }
    \`\`\`
  `,

  /**
   * Prompt for generating Selenium Java Page class ONLY
   * (No test class).
   */
  SELENIUM_JAVA_PAGE_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want ONLY a Selenium Java PAGE OBJECT CLASS for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}

    Requirements:
    1. Use recommended Selenium locator strategies in priority:
       - By.id (avoid if the id has more than a single number)
       - By.name
       - By.linkText or partialLinkText for links
       - By.xpath (use relative or following or preceding based on best case)
       - By.cssSelector (avoid "genai" attributes) only if others aren’t suitable

    2. Implementation guidelines:
       - Java 8+ features if appropriate
       - Use explicit waits (ExpectedConditions)
       - Add JavaDoc for methods & class
       - Use Javafaker if needed
       - DO NOT provide any TestNG test class—only the page class
       - Use PageFactory & @FindBy to show how elements are found

    3. Code structure:
       - Single page class
       - A constructor that accepts WebDriver
       - Use PageFactory.initElements
       - Provide only the code block, no other text

    Example:
    \`\`\`java
    package com.genai.pages;

    import org.openqa.selenium.WebDriver;
    import org.openqa.selenium.support.FindBy;
    import org.openqa.selenium.support.PageFactory;
    import org.openqa.selenium.support.ui.WebDriverWait;
    import java.time.Duration;

    public class ComponentPage {
        private final WebDriver driver;
        private final WebDriverWait wait;

        public ComponentPage(WebDriver driver) {
            this.driver = driver;
            this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
            PageFactory.initElements(driver, this);
        }

        // Page elements and methods
    }
    \`\`\`
  `,
/**
 * prompt for PLAYWRIGHT_TEST_ONLY
 */
PLAYWRIGHT_TEST_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`
    We want ONLY a Playwright TEST CLASS using TypeScript (no page object class).
    Action to perform: \${userAction}
    URL: \${pageUrl}
    Requirements:
    1. Use recommended Playwright locator strategies:
       - Use \`page.locator()\` with the most specific selector available.
       - Prefer \`getByRole()\`, \`getByText()\`, \`getByLabel()\`, \`getByPlaceholder()\`, \`getByAltText()\`, \`getByTitle()\` where applicable.
       - Avoid using XPath unless absolutely necessary.
    2. Implementation guidelines:
       - Use async/await for handling asynchronous operations.
       - Use Playwright’s auto-waiting mechanism; avoid explicit waits.
       - Use Playwright’s built-in assertions.
       - Maintain proper TypeScript typings (Page, Browser, etc.).
       - Optimize code structure, removing unnecessary waits or redundant calls.
       - Ensure that logging/debugging mechanisms (if present in Selenium) are mapped correctly to Playwright equivalents.
       - The output must be idiomatic Playwright TypeScript, not just a direct Java-to-TypeScript translation.
       - Follow Playwright Official Documentation to ensure all functions are correctly implemented.
       - DO NOT add any additional steps other than given input code.
       - Make sure to wait for \`domcontentloaded\`.
    3. Code structure:
       - Show only a single test class.
       - Use \`beforeAll\`, \`test\`, and \`afterAll\` hooks.
       - Use meaningful method names.
       - Provide only the test class code block, no other text.
    Example:
    \`\`\`typescript
    import { test, expect, Page } from '@playwright/test';

    test.describe('Component Test', () => {
        let page: Page;

        test.beforeAll(async ({ browser }) => {
            page = await browser.newPage();
            await page.goto('\${pageUrl}', { waitUntil: 'domcontentloaded' });
        });

        test('testComponentAction', async () => {
            // Implementation
        });

        test.afterAll(async () => {
            await page.close();
        });
    });
    \`\`\`
`,

/**
 * prompt for PLAYWRIGHT_PAGE_ONLY
 */
PLAYWRIGHT_PAGE_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`
    We want ONLY a Playwright PAGE OBJECT CLASS for that DOM.
    Action to perform: \${userAction}
    URL: \${pageUrl}
    Requirements:
    1. Use recommended Playwright locator strategies:
       - Use \`page.locator()\` with the most specific selector available.
       - Prefer \`getByRole()\`, \`getByText()\`, \`getByLabel()\`, \`getByPlaceholder()\`, \`getByAltText()\`, \`getByTitle()\` where applicable.
       - Avoid using XPath unless absolutely necessary.
    2. Implementation guidelines:
       - Use async/await for handling asynchronous operations.
       - Use Playwright’s auto-waiting mechanism; avoid explicit waits.
       - Use Playwright’s built-in assertions.
       - Maintain proper TypeScript typings (Page, Browser, etc.).
       - Optimize code structure, removing unnecessary waits or redundant calls.
       - Ensure that logging/debugging mechanisms (if present in Selenium) are mapped correctly to Playwright equivalents.
       - The output must be idiomatic Playwright TypeScript, not just a direct Java-to-TypeScript translation.
       - Follow Playwright Official Documentation to ensure all functions are correctly implemented.
       - DO NOT provide any test class—only the page class.
    3. Code structure:
       - Single page class.
       - A constructor that accepts Page.
       - Provide only the code block, no other text.
    Example:
    \`\`\`typescript
    import { Page, Locator } from '@playwright/test';

    export class ComponentPage {
        private readonly page: Page;

        constructor(page: Page) {
            this.page = page;
        }

        // Page elements and methods
    }
    \`\`\`
`,
  /**
   * Prompt for generating Cucumber Feature file
   */
  CUCUMBER_ONLY: `
    Given the following DOM structure:
    \`\`\`html
    \${domContent}
    \`\`\`

    We want a **Cucumber (Gherkin) .feature file** referencing **every relevant field** in the DOM snippet.

    **Instructions**:
    1. **Do not** include any explanations or extra text beyond the .feature content.
    2. **Identify** each relevant element (input, textarea, select, button, etc.).
    3. For each element, **create one step** referencing a placeholder (e.g. \`<fieldName>\`):
      - e.g. "When I type <companyName> into the 'Company Name' field"
      - e.g. "And I choose <state> in the 'State' dropdown"
      - e.g. "And I click the 'Create Lead' button"
    4. Use a **Scenario Outline** + **Examples** to parametrize these placeholders.
    5. **Ensure one action per step**.
    6. Output **only** valid Gherkin in a single \`\`\`gherkin code block.

    Produce **only** the .feature content as below :
    \`\`\`gherkin
    Feature: Describe your feature
      As a user of the system
      I want to \${userAction}
      So that <some reason>

      Scenario Outline: A scenario describing \${userAction}
        Given I open "\${pageUrl}"
        # For each input, select, button in the snippet:
        #   - create a single step referencing it with a placeholder
        #   - e.g. "When I enter <companyName> in the 'Company Name' field"
        #   - e.g. "And I click the 'Create Lead' button"
        #   - etc.
        # ...
        Then I should see <some expected outcome>

      # Provide a minimal Examples table with columns for each placeholder:
      Examples:
        | companyName   | firstName   | lastName   | description   | generalCity   | state   |
        | "Acme Corp"   | "Alice"     | "Tester"   | "Some text"   | "Dallas"      | "TX"    |
        | "Mega Corp"   | "Bob"       | "Sample"   | "Other desc"  | "Miami"       | "FL"    |
    \`\`\`
    `
};

/**
 * Helper function to escape code blocks in prompts
 */
function escapeCodeBlocks(text) {
  return text.replace(/```/g, '\\`\\`\\`');
}

/**
 * Function to fill template variables in a prompt
 */
export function getPrompt(promptKey, variables = {}) {
  let prompt = DEFAULT_PROMPTS[promptKey];
  if (!prompt) {
    throw new Error(`Prompt not found: ${promptKey}`);
  }

  // Replace all variables in the prompt
  Object.entries(variables).forEach(([k, v]) => {
    const regex = new RegExp(`\\\${${k}}`, 'g');
    prompt = prompt.replace(regex, v);
  });

  return prompt.trim();
}

export const CODE_GENERATOR_TYPES = {
  
  SELENIUM_JAVA_PAGE_ONLY: 'Selenium-Java-Page-Only',
  SELENIUM_JAVA_TEST_ONLY: 'Selenium-Java-Test-Only',
  PLAYWRIGHT_TEST_ONLY: 'Playwright-Test-only',
  PLAYWRIGHT_PAGE_ONLY: 'Playwright-Page-Only',
  CUCUMBER_ONLY: 'Cucumber-Only'
};
