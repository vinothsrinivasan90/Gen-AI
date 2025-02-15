import { getPrompt } from '../scripts/prompts.js';

// Constants
const INITIAL_SYSTEM_MESSAGE = ``;

class ChatUI {
    constructor() {
        // Grab references
        this.messagesContainer     = document.getElementById('chatMessages');
        //this.inputField            = document.getElementById('chatInput');
        this.sendButton            = document.getElementById('sendMessage');
        this.inspectorButton       = document.getElementById('inspectorButton');
        this.resetButton           = document.getElementById('resetChat');

        // Language / Browser dropdown
        this.languageBindingSelect = document.getElementById('languageBinding');
        this.browserEngineSelect   = document.getElementById('browserEngine');

        // Additional states
        this.selectedDomContent    = null;
        this.isInspecting          = false;
        this.markdownReady         = false;
        this.codeGeneratorType     = 'SELENIUM_JAVA_PAGE_ONLY'; // default 
        this.tokenWarningThreshold = 10000;
        this.cumulativeCost        = 0;
        this.selectedModel         = '';
        this.selectedProvider      = '';

        // Cost for each model
        this.modelCosts = {
            'gpt-4o':                     { input: 0.0025, output: 0.01 },
            'gpt-4o-mini':               { input: 0.00015,output: 0.0006 },
            'gpt-3.5-turbo':             { input: 0.003,   output: 0.006 },
            'llama3.2':                  { input: 0,       output: 0 },
            'llama3.1':                  { input: 0,       output: 0 }
        };

        // Clear existing messages + add initial system message
        this.messagesContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
            </div>
        `;
        this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

        // Initialize everything
        this.initialize();
        this.initializeMarkdown();
        this.initializeTokenThreshold();
        this.initializeCumulativeCost();
        this.initializeCodeGeneratorType();
        this.setupDropdowns();
    }

    initialize() {
        // Reset chat
        if (this.resetButton) {
            this.resetButton.addEventListener('click', () => {
                this.messagesContainer.innerHTML = '';
                this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

                // Reset DOM selection
                this.selectedDomContent = null;
                this.inspectorButton.classList.remove('has-content','active');
                this.inspectorButton.innerHTML = `
                    <i class="fas fa-mouse-pointer"></i>
                    <span>Inspect</span>
                `;
                this.isInspecting = false;
            });
        }

        // Load stored keys
        chrome.storage.sync.get(
          ['groqApiKey','openaiApiKey','selectedModel','selectedProvider'],
          (result) => {
            if (result.groqApiKey)   this.groqAPI   = new GroqAPI(result.groqApiKey);
            if (result.openaiApiKey) this.openaiAPI = new OpenAIAPI(result.openaiApiKey);
            this.selectedModel    = result.selectedModel    || '';
            this.selectedProvider = result.selectedProvider || '';
        });

        // Listen for changes
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.groqApiKey)       this.groqAPI   = new GroqAPI(changes.groqApiKey.newValue);
            if (changes.openaiApiKey)     this.openaiAPI = new OpenAIAPI(changes.openaiApiKey.newValue);
            if (changes.selectedModel)    this.selectedModel = changes.selectedModel.newValue;
            if (changes.selectedProvider) this.selectedProvider = changes.selectedProvider.newValue;
        });

        // Listen for SELECTED_DOM_CONTENT from content.js
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.type === 'SELECTED_DOM_CONTENT') {
                this.selectedDomContent = msg.content;
                this.inspectorButton.classList.add('has-content');
            }
        });

        // Send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        /*this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        }); */

        // Inspector button
        this.inspectorButton.addEventListener('click', async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) return;

                if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                    console.log('Cannot use inspector on this page');
                    return;
                }

                // Try to inject content script
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (error) {
                    if (!error.message.includes('already been injected')) {
                        throw error;
                    }
                }

                const port = chrome.tabs.connect(tab.id);
                port.postMessage({ type: 'TOGGLE_INSPECTOR', reset: true });

                this.isInspecting = !this.isInspecting;
                this.updateInspectorButtonState();
            } catch (error) {
                console.error('Inspector error:', error);
                this.addMessage('Failed to activate inspector. Please refresh and try again.', 'system');
                this.isInspecting = false;
                this.updateInspectorButtonState();
            }
        });

        // Optional: handle reset cost button
        const resetCostBtn = document.getElementById('resetCostBtn');
        if (resetCostBtn) {
            resetCostBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to reset the total cost counter?')) {
                    await this.resetCumulativeCost();
                }
            });
        }
    }

    // ===================
    // Markdown / Parsing
    // ===================
    initializeMarkdown() {
        const checkLibraries = setInterval(() => {
            if (window.marked && window.Prism) {
                window.marked.setOptions({
                    highlight: (code, lang) => {
                        if (lang && Prism.languages[lang]) {
                            try {
                                return Prism.highlight(code, Prism.languages[lang], lang);
                            } catch (e) {
                                console.error('Prism highlight error:', e);
                                return code;
                            }
                        }
                        return code;
                    },
                    langPrefix: 'language-',
                    breaks: true,
                    gfm: true
                });

                const renderer = new marked.Renderer();
                renderer.code = (code, language) => {
                    // If code is an object, extract the actual code from the text property
                    if (typeof code === 'object') {
                        if (code.text) {
                            code = code.text;
                        } else if (code.raw) {
                            // Extract code from raw, removing the code fence markers
                            code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                        } else {
                            code = JSON.stringify(code, null, 2);
                        }
                    }
                    
                    // Clean up the language string
                    const validLanguage = language?.toLowerCase().trim() || 'typescript';
                    
                    let highlighted = code;
                    if (validLanguage && Prism.languages[validLanguage]) {
                        try {
                            highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                        } catch (e) {
                            console.error('Highlighting failed:', e);
                        }
                    }

                    return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
                };

                marked.setOptions({ renderer });
                this.markdownReady = true;
                clearInterval(checkLibraries);
            }
        }, 100);
    }

    parseMarkdown(content) {
        if (!this.markdownReady) {
            return `<pre>${content}</pre>`;
        }

        // Handle different content formats
        let textContent;
        if (typeof content === 'string') {
            // Extract the language from the code fence if present
            const match = content.match(/^```(\w+)/);
            // Remove the language identifier from the content
            textContent = content.replace(/^```\w+/, '```');
        } else if (typeof content === 'object') {
            textContent = content.content || 
                         content.message?.content ||
                         content.choices?.[0]?.message?.content ||
                         JSON.stringify(content, null, 2);
        } else {
            textContent = String(content);
        }

        // Clean up and normalize code blocks
        let processedContent = textContent
            .replace(/&#x60;/g, '`')
            .replace(/&grave;/g, '`')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            // Keep the language identifier in triple backticks
            .replace(/```(\w*)/g, '\n```$1\n')
            .replace(/```\s*$/g, '\n```\n')
            .replace(/\n{3,}/g, '\n\n');

        try {
            const renderer = new marked.Renderer();
            renderer.code = (code, language) => {
                // If code is an object, extract the actual code from the text property
                if (typeof code === 'object') {
                    if (code.text) {
                        code = code.text;
                    } else if (code.raw) {
                        code = code.raw.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                    } else {
                        code = JSON.stringify(code, null, 2);
                    }
                }
                
                const validLanguage = language?.toLowerCase().trim() || 'typescript';

                let highlighted = code;
                if (validLanguage && Prism.languages[validLanguage]) {
                    try {
                        highlighted = Prism.highlight(code, Prism.languages[validLanguage], validLanguage);
                    } catch (e) {
                        console.error('Highlighting failed:', e);
                    }
                }

                return `<pre class="language-${validLanguage}"><code class="language-${validLanguage}">${highlighted}</code></pre>`;
            };

            marked.setOptions({ renderer });
            const parsed = marked.parse(processedContent);
            
            // After parsing, re-run Prism highlighting
            setTimeout(() => {
                const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
                codeBlocks.forEach(block => {
                    Prism.highlightElement(block);
                });
            }, 0);

            return parsed;
        } catch (error) {
            console.error('Markdown parsing error:', error);
            return `<pre>${textContent}</pre>`;
        }
    }

    // =============
    // Send Message
    // =============
    async sendMessage() {
        //const userMsg = this.inputField.value.trim();
        //if (!userMsg) return;

        let apiRef = null;
        if (this.selectedProvider === 'groq')   apiRef = this.groqAPI;
        else apiRef = this.openaiAPI;

        if (!apiRef) {
            this.addMessage(`Please set your ${this.selectedProvider} API key in the Settings tab.`, 'system');
            return;
        }

        if (!this.selectedDomContent) {
            const { combinedDomSnippet } = await chrome.storage.local.get(['combinedDomSnippet']);
            if (typeof combinedDomSnippet === 'string' && combinedDomSnippet.length > 0) {
                this.selectedDomContent = combinedDomSnippet;
            }
            if (!this.selectedDomContent) {
                this.addMessage('Please select DOM elements first using Inspect.', 'system');
                return;
            }
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pageUrl = tab?.url || 'unknown';

            // If codeGeneratorType is Selenium-Java, read the radio for "PAGE" vs. "TEST"
            let javaGenMode = 'TEST';
            const lang = this.languageBindingSelect.value;   // 'java','csharp','typescript'
            const eng  = this.browserEngineSelect.value;     // 'selenium','playwright'
            this.codeGeneratorType = this.getPromptKey(lang, eng);

            console.log("The codeGeneratorType >> "+this.codeGeneratorType);

            if (this.codeGeneratorType.includes('SELENIUM_JAVA')) {
                const selectedRadio = document.querySelector('input[name="javaGenerationMode"]:checked');
                if (selectedRadio) {
                    javaGenMode = selectedRadio.value;  // "PAGE" or "TEST" or "FEATURE"
                }
            }
            console.log("The selenium java type >> "+javaGenMode);

            // Build prompt
            const finalSnippet = typeof this.selectedDomContent === 'string'
              ? this.selectedDomContent
              : JSON.stringify(this.selectedDomContent, null, 2);

            const finalPrompt = getPrompt(this.codeGeneratorType, {
                domContent: finalSnippet,
                //userAction: userMsg,
                pageUrl: pageUrl,
                javaMode: javaGenMode
            });

            // Estimate tokens
            const tokenCount = estimateTokenCount(finalPrompt);
            if (tokenCount > this.tokenWarningThreshold) {
                const proceed = await this.showTokenWarningAlert(tokenCount);
                if (!proceed) return;
            }

            this.sendButton.disabled = true;
            //this.inputField.disabled = true;
            this.sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            // show user message
            //this.addMessage(userMsg, 'user');
            //this.inputField.value = '';

            console.log("The API request >> "+finalPrompt);

            // Call the AI provider
            const response = await apiRef.sendMessage(finalPrompt, this.selectedModel);

            // remove loader
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();

            console.log('[API Response]', response);

            // Extract text
            const messageContent =
                response?.content ||
                response?.message?.content ||
                response?.choices?.[0]?.message?.content ||
                response;

            // usage
            const inputTokens  = response.usage?.input_tokens  || 0;
            const outputTokens = response.usage?.output_tokens || 0;
            const inputCost    = this.calculateCost(inputTokens,'input');
            const outputCost   = this.calculateCost(outputTokens,'output');
            const totalCost    = inputCost + outputCost;

            // show assistant
            this.addMessageWithMetadata(messageContent, 'assistant', {
                inputTokens,
                outputTokens,
                inputCost,
                outputCost,
                totalCost
            });

            // reset selection
            this.selectedDomContent = null;
            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
            this.isInspecting = false;

            // cleanup
            if (tab) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEAR_SELECTION' });
                } catch (err) {
                    const port = chrome.tabs.connect(tab.id);
                    port.postMessage({ type: 'CLEAR_SELECTION' });
                    port.disconnect();
                }
            }

        } catch (err) {
            // remove loader if present
            const loader = this.messagesContainer.querySelector('.loading-indicator.active');
            if (loader) loader.remove();

            this.addMessage(`Error: ${err.message}`, 'system');
        } finally {
            this.sendButton.disabled = false;
            //this.inputField.disabled = false;
            this.sendButton.innerHTML = 'Generate';
        }
    }

    // ==============
    // addMessage UI
    // ==============
    addMessage(content, type) {
        if (!content) return;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${type}-message`;

        if (type === 'system') {
            msgDiv.innerHTML = content;
        } else {
            const markdownDiv = document.createElement('div');
            markdownDiv.className = 'markdown-content';
            markdownDiv.innerHTML = this.parseMarkdown(content);
            msgDiv.appendChild(markdownDiv);
        }
        this.messagesContainer.appendChild(msgDiv);

        // If user => add loader
        if (type === 'user') {
            const loader = document.createElement('div');
            loader.className = 'loading-indicator';
            const genType = this.codeGeneratorType.includes('PLAYWRIGHT') ? 'Playwright' : 'Selenium';
            loader.innerHTML = `
              <div class="loading-spinner"></div>
              <span class="loading-text">Generating ${genType} Code</span>
            `;
            this.messagesContainer.appendChild(loader);
            setTimeout(() => loader.classList.add('active'), 0);
        }
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // Show reset button if messages exist
        const msgCount = this.messagesContainer.querySelectorAll('.chat-message').length;
        if (msgCount > 1 && this.resetButton) {
            this.resetButton.classList.add('visible');
        }
    }

    addMessageWithMetadata(content, type, metadata) {
        if (type !== 'assistant') {
            this.addMessage(content, type);
            return;
        }

        // Build an assistant message with cost details
        const container = document.createElement('div');
        container.className = 'assistant-message';

        const mdDiv = document.createElement('div');
        mdDiv.className = 'markdown-content';
        mdDiv.innerHTML = this.parseMarkdown(content);
        container.appendChild(mdDiv);

        const metaContainer = document.createElement('div');
        metaContainer.className = 'message-metadata collapsed';

        // actions
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'metadata-toggle';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'metadata-toggle';
        copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`;
        copyBtn.onclick = () => {
            const codeBlocks = mdDiv.querySelectorAll('pre code');
            if (codeBlocks.length === 0) {
                copyBtn.innerHTML = `<i class="fas fa-times"></i> No content found`;
                setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy`; }, 2000);
                return;
            }
            // Combine code
            let combinedCode = Array.from(codeBlocks).map(block => block.textContent.trim()).join('\n\n');
            combinedCode = combinedCode.replace(/^```[\w-]*\n/, '').replace(/\n```$/, '');

            navigator.clipboard.writeText(combinedCode)
                .then(() => {
                    copyBtn.innerHTML = `<i class="fas fa-check"></i> Copied!`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    copyBtn.innerHTML = `<i class="fas fa-times"></i> Failed to copy`;
                    setTimeout(() => { copyBtn.innerHTML = `<i class="fas fa-copy"></i> Copy code`; }, 2000);
                });
        };

        actions.appendChild(toggleBtn);
        actions.appendChild(copyBtn);
        metaContainer.appendChild(actions);

        // Detailed cost
        const details = document.createElement('div');
        details.className = 'metadata-content';
        const costDisplay      = `$${metadata.inputCost.toFixed(4)}`;
        const outCostDisplay   = `$${metadata.outputCost.toFixed(4)}`;
        const totalCostDisplay = `$${metadata.totalCost.toFixed(4)}`;
        details.innerHTML = `
          <div class="metadata-row"><span>Input Tokens:</span><span>${metadata.inputTokens}</span></div>
          <div class="metadata-row"><span>Output Tokens:</span><span>${metadata.outputTokens}</span></div>
          <div class="metadata-row"><span>Input Cost:</span><span>${costDisplay}</span></div>
          <div class="metadata-row"><span>Output Cost:</span><span>${outCostDisplay}</span></div>
          <div class="metadata-row total"><span>Total Cost:</span><span>${totalCostDisplay}</span></div>
        `;
        metaContainer.appendChild(details);
        container.appendChild(metaContainer);

        this.messagesContainer.appendChild(container);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // If there's a reset button, show it
        if (this.resetButton) {
            this.resetButton.classList.add('visible');
        }

        // Update cumulative cost
        this.updateCumulativeCost(metadata.totalCost);
    }

    // ================
    // Inspector Button
    // ================
    updateInspectorButtonState() {
        if (this.isInspecting) {
            this.inspectorButton.classList.add('active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Stop</span>
            `;
        } else {
            this.inspectorButton.classList.remove('active');
            if (!this.selectedDomContent) {
                this.inspectorButton.classList.remove('has-content');
            }
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;
        }
    }

    // ================
    // Dropdown / Setup
    // ================
    setupDropdowns() {
        if (!this.languageBindingSelect || !this.browserEngineSelect) return;

        const updateDropdowns = () => {
            const lang = this.languageBindingSelect.value;   // 'java','csharp','typescript'
            const eng  = this.browserEngineSelect.value;     // 'selenium','playwright'

            // If TypeScript => force Playwright, disable Selenium
            if (lang === 'typescript') {
                this.browserEngineSelect.value = 'playwright';
                const selOpt = this.browserEngineSelect.querySelector('option[value="selenium"]');
                if (selOpt) selOpt.disabled = true;
            } else {
                const selOpt = this.browserEngineSelect.querySelector('option[value="selenium"]');
                if (selOpt) selOpt.disabled = false;
            }

            this.codeGeneratorType = this.getPromptKey(lang, eng);
            chrome.storage.sync.set({ codeGeneratorType: this.codeGeneratorType });
        };

        updateDropdowns();

        this.languageBindingSelect.addEventListener('change', updateDropdowns);
        this.browserEngineSelect.addEventListener('change', updateDropdowns);
    }

    getPromptKey(language, engine) {
        // If it's TypeScript+Playwright, we do:
        if (language === 'typescript' && engine === 'playwright') {
            const selectedRadio = document.querySelector('input[name="javaGenerationMode"]:checked');
          if (!selectedRadio) {
            // fallback
            return 'PLAYWRIGHT_TEST_ONLY'; 
          }
          const radioValue = selectedRadio.value; // "PAGE" or "TEST"
    
          if (radioValue === 'PAGE') {
            return 'PLAYWRIGHT_PAGE_ONLY';
          } else if (radioValue === 'TEST') {
            return 'PLAYWRIGHT_TEST_ONLY';
          } else{
            return 'CUCUMBER_ONLY';
          }
          
        }
        // If it's Java+Selenium, let's see which radio was chosen:
        if (language === 'java' && engine === 'selenium') {
          // read the radio buttons
          const selectedRadio = document.querySelector('input[name="javaGenerationMode"]:checked');
          if (!selectedRadio) {
            // fallback
            return 'SELENIUM_JAVA_TEST_ONLY'; 
          }
          const radioValue = selectedRadio.value; // "PAGE" or "TEST"
    
          if (radioValue === 'PAGE') {
            return 'SELENIUM_JAVA_PAGE_ONLY';
          } else if (radioValue === 'TEST') {
            return 'SELENIUM_JAVA_TEST_ONLY';
          } else{
            return 'CUCUMBER_ONLY';
          }
        }
        // if csharp+selenium...
        if (language === 'csharp' && engine === 'selenium') {
          return 'SELENIUM_CSHARP_CODE_GENERATION';
        }
        
        // fallback
        return 'PLAYWRIGHT_CODE_GENERATION';
      }
      

    // ================
    // Token Threshold
    // ================
    async initializeCodeGeneratorType() {
        const { codeGeneratorType } = await chrome.storage.sync.get(['codeGeneratorType']);
        if (codeGeneratorType) {
            this.codeGeneratorType = codeGeneratorType;
            const codeGenDrop = document.getElementById('codeGeneratorType');
            if (codeGenDrop) codeGenDrop.value = this.codeGeneratorType;
        }
    }

    async initializeTokenThreshold() {
        const { tokenWarningThreshold } = await chrome.storage.sync.get(['tokenWarningThreshold']);
        if (tokenWarningThreshold) {
            this.tokenWarningThreshold = tokenWarningThreshold;
        }
        const threshInput = document.getElementById('tokenThreshold');
        if (threshInput) {
            threshInput.value = this.tokenWarningThreshold;
            threshInput.addEventListener('change', async (e) => {
                const val = parseInt(e.target.value,10);
                if (val >= 100) {
                    this.tokenWarningThreshold = val;
                    await chrome.storage.sync.set({ tokenWarningThreshold: val });
                } else {
                    e.target.value = this.tokenWarningThreshold;
                }
            });
        }
    }

    async initializeCumulativeCost() {
        const { cumulativeCost } = await chrome.storage.sync.get(['cumulativeCost']);
        this.cumulativeCost = cumulativeCost || 0;
        this.updateCumulativeCostDisplay();
    }

    updateCumulativeCostDisplay() {
        const costEl = document.getElementById('cumulativeCost');
        if (costEl) {
            costEl.textContent = `$${this.cumulativeCost.toFixed(4)}`;
        }
    }

    async updateCumulativeCost(addCost) {
        // skip if llama
        if (this.selectedModel && this.selectedModel.includes('llama')) {
            return;
        }
        this.cumulativeCost += addCost;
        await chrome.storage.sync.set({ cumulativeCost: this.cumulativeCost });
        this.updateCumulativeCostDisplay();
    }

    async resetCumulativeCost() {
        this.cumulativeCost = 0;
        await chrome.storage.sync.set({ cumulativeCost: 0 });
        this.updateCumulativeCostDisplay();
    }

    // ================
    // Token Warnings
    // ================
    showTokenWarningAlert(estimatedTokens) {
        return new Promise((resolve) => {
            this.sendButton.disabled = true;
            //this.inputField.disabled = true;

            const alertDialog = document.createElement('div');
            alertDialog.className = 'alert-dialog';
            alertDialog.innerHTML = `
                <div class="alert-content" style="border: 3px solid #007bff; border-radius: 8px; box-shadow: 0 0 10px rgba(255, 107, 43, 0.3); overflow: hidden;">
                    <div class="alert-header" style="padding: 16px; background-color: #1e1e1e;">
                        <i class="fas fa-exclamation-triangle" style="color: #007bff !important;"></i>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <span style="color: #007bff !important; font-size: 14px; font-weight: 600;">Input Token Warning:</span>
                            <span style="color: #ffffff; font-size: 13px;">
                                Approx. ${estimatedTokens.toLocaleString()} tokens [Threshold: ${this.tokenWarningThreshold.toLocaleString()}]. 
                                Higher API costs may apply.
                            </span>
                        </div>
                    </div>
                    <div class="alert-footer" style="padding: 16px; background-color: #2a2a2a;">
                        <div style="display: flex; justify-content: flex-end; gap: 16px;">
                            <button id="cancelBtn" style="padding: 6px 12px; background: #2d2d2d; color: #007bff; border: 1px solid #007bff; border-radius: 4px;">Cancel</button>
                            <button id="proceedBtn" style="padding: 6px 12px; background: #ff3333; color: #fff; border: none; border-radius: 4px;">Proceed</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(alertDialog);

            const handleClick = (proceed) => {
                alertDialog.remove();
                this.sendButton.disabled = false;
                //this.inputField.disabled = false;
                resolve(proceed);
            };

            alertDialog.querySelector('#cancelBtn').onclick  = () => handleClick(false);
            alertDialog.querySelector('#proceedBtn').onclick = () => handleClick(true);
        });
    }

    // ================
    // Cost Calculation
    // ================
    calculateCost(tokens, type) {
        if (!this.selectedModel || !this.modelCosts[this.selectedModel]) {
            return 0;
        }
        return (tokens / 1000) * this.modelCosts[this.selectedModel][type];
    }

    // ================
    // Reset Chat
    // ================
    async resetChat() {
        try {
            this.messagesContainer.innerHTML = `
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                </div>
            `;

            this.selectedDomContent = null;
            this.isInspecting       = false;
            this.markdownReady      = false;

            this.inspectorButton.classList.remove('has-content','active');
            this.inspectorButton.innerHTML = `
                <i class="fas fa-mouse-pointer"></i>
                <span>Inspect</span>
            `;

            //this.inputField.value = '';
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Generate';

            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && !tab.url.startsWith('chrome://')) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
                } catch (err) {
                    console.log('Cleanup error:', err);
                }
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['src/content/content.js']
                    });
                } catch (err) {
                    if (!err.message.includes('already been injected')) {
                        console.error('Re-inject error:', err);
                    }
                }
            }
            if (this.resetButton) {
                this.resetButton.classList.remove('visible');
            }

            this.addMessage(INITIAL_SYSTEM_MESSAGE, 'system');

        } catch (err) {
            console.error('Error resetting chat:', err);
            this.addMessage('Error resetting chat. Please close and reopen.', 'system');
        }
    }
}

/**
 * Simple token estimator
 */
function estimateTokenCount(text) {
    if (!text || typeof text !== 'string') return 0;
    const chunks = text.match(/\b\w+\b|\s+|[^\w\s]/g) || [];
    let est = 0;
    for (const chunk of chunks) {
        if (/^\s+$/.test(chunk)) {
            est += 1;
        } else if (/^[^\w\s]$/.test(chunk)) {
            est += 1;
        } else if (/^\d+$/.test(chunk)) {
            est += Math.ceil(chunk.length / 2);
        } else {
            est += Math.max(1, Math.ceil(chunk.length / 4));
        }
    }
    return est;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new ChatUI();
});
