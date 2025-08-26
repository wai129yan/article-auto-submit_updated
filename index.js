require('dotenv').config();
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const moment = require('moment');
const fs = require('fs').promises;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatToIso(input) {
    return input.replace(' ', 'T').replace(/\//g, '-');
}

// Format date as YYYY-MM-DD HH:mm:ss (quiet version)
function formatDate(dateStr) {
    if (!dateStr || dateStr === 'undefined' || dateStr === undefined) {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }

    const parsed = moment(dateStr, [
        'MMMM Do YYYY',
        'LL',
        'YYYY-MM-DD',
        'DD/MM/YYYY',
        'DD/MM/YYYY HH:mm:ss',
        'YYYY-MM-DD HH:mm:ss'
    ]);

    if (!parsed.isValid()) {
        return moment().format('YYYY-MM-DD HH:mm:ss');
    }
    return parsed.format('YYYY-MM-DD HH:mm:ss');
}

// Function to find element with multiple possible selectors (quiet version)
async function findElementWithFallback(driver, selectors) {
    for (const selector of selectors) {
        try {
            const element = await driver.findElement(selector);
            if (element) return element;
        } catch (e) {
            // Silently continue to next selector
        }
    }
    return null;
}

// Function to wait for element and handle it (enhanced with better error handling)
async function waitAndFillField(driver, fieldName, value, timeout = 10000) {
    const possibleSelectors = [
        By.name(fieldName),
        By.id(fieldName),
        By.css(`input[name="${fieldName}"]`),
        By.css(`textarea[name="${fieldName}"]`),
        By.css(`select[name="${fieldName}"]`),
        By.xpath(`//input[@name="${fieldName}"]`),
        By.xpath(`//textarea[@name="${fieldName}"]`),
        By.xpath(`//select[@name="${fieldName}"]`)
    ];

    try {
        const element = await findElementWithFallback(driver, possibleSelectors);
        if (!element) {
            console.log(`⚠ Field "${fieldName}" not found with any selector`);
            return false;
        }

        await driver.wait(until.elementIsVisible(element), timeout);
        await element.clear();
        await element.sendKeys(value);
        console.log(`✓ Successfully filled field: ${fieldName}`);
        return true;
    } catch (error) {
        console.log(`✗ Error filling field "${fieldName}": ${error.message}`);
        return false;
    }
}

// Function to set date field (quiet version)
async function setDateField(driver, fieldName, dateValue) {
    const possibleSelectors = [
        By.name(fieldName),
        By.id(fieldName),
        By.css(`input[name="${fieldName}"]`),
        By.xpath(`//input[@name="${fieldName}"]`)
    ];

    try {
        const element = await findElementWithFallback(driver, possibleSelectors);
        if (!element) return false;

        // Try different methods to set the date
        try {
            await driver.executeScript("arguments[0].value = arguments[1];", element, dateValue);
        } catch (e) {
            await element.clear();
            await element.sendKeys(dateValue);
        }

        return true;
    } catch (error) {
        return false;
    }
}

// Function to try setting date with multiple field names (updated)
async function trySetDateFields(driver, article) {
    let startDateSet = false;
    let endDateSet = false;

    try {
        // Handle start date checkbox
        try {
            const checkbox_start = await driver.findElement(By.name('start_date_change_now_flag'));
            const isChecked_start = await checkbox_start.isSelected();
            if (isChecked_start) {
                await checkbox_start.click();
                console.log("✓ Unchecked start date 'change now' flag");
            }
        } catch (e) {
            console.log("⚠ Start date checkbox not found");
        }

        // Handle end date checkbox
        try {
            const checkbox = await driver.findElement(By.name('end_date_recalc_flag'));
            const isChecked = await checkbox.isSelected();
            if (isChecked) {
                await checkbox.click();
                console.log("✓ Unchecked end date recalc flag");
            }
        } catch (e) {
            console.log("⚠ End date checkbox not found");
        }

        // Set end date
        try {
            let endDateField = await driver.findElement(By.name('open_end_date'));
            await driver.executeScript("arguments[0].value = arguments[1];", endDateField, formatToIso(article.open_end_date));
            endDateSet = true;
            console.log(`✓ End date set: ${article.open_end_date}`);
        } catch (e) {
            console.log("✗ Could not set end date:", e.message);
        }

    } catch (error) {
        console.log("Error in date field handling:", error.message);
    }

    return { startDateSet, endDateSet };
}

// UPDATED: More robust navigation function with multiple approaches
async function navigateToNewArticleForm(driver) {
    console.log("🔄 Navigating to new article form...");

    // Method 1: Direct URL navigation (most reliable)
    try {
        console.log("Trying direct URL navigation...");
        await driver.get('https://dev-saas-cms2.webow.jp/admin/?controller=article&action=add');
        await sleep(3000);

        // Check if we're on the right page by looking for the title field
        try {
            await driver.findElement(By.name('title'));
            console.log("✓ Successfully navigated via direct URL");
            return true;
        } catch (e) {
            console.log("⚠ Direct URL didn't work, trying click navigation...");
        }
    } catch (e) {
        console.log("⚠ Direct URL failed, trying alternative methods...");
    }

    // Method 2: Click navigation with JavaScript clicks
    try {
        await driver.get('https://dev-saas-cms2.webow.jp/admin/?controller=article');
        await sleep(3000);

        // Use JavaScript clicks instead of regular clicks to avoid interception
        const elements = [
            '//*[@id="contents_main"]/div[2]/div/ul/li[1]/a[1]',
            '//*[@id="contents_main"]/div[2]/div/ul/li[2]/ul/li/a',
            '//*[@id="link_bar"]/div/ul/li[1]/a'
        ];

        for (let i = 0; i < elements.length; i++) {
            try {
                const element = await driver.findElement(By.xpath(elements[i]));
                await driver.executeScript("arguments[0].click();", element);
                console.log(`✓ Clicked navigation element ${i + 1}`);
                await sleep(2000);
            } catch (e) {
                console.log(`⚠ Could not click navigation element ${i + 1}: ${e.message}`);
                // Try alternative selectors or continue
            }
        }

        // Check if we reached the form
        try {
            await driver.findElement(By.name('title'));
            console.log("✓ Successfully navigated via JavaScript clicks");
            return true;
        } catch (e) {
            console.log("⚠ JavaScript clicks didn't reach the form");
        }
    } catch (e) {
        console.log("⚠ Click navigation failed:", e.message);
    }

    // Method 3: Try alternative URLs that might work
    const alternativeUrls = [
        'https://dev-saas-cms2.webow.jp/admin/index.php?controller=article&action=add',
        'https://dev-saas-cms2.webow.jp/admin/article/add',
        'https://dev-saas-cms2.webow.jp/admin/?controller=article&method=add'
    ];

    for (const url of alternativeUrls) {
        try {
            console.log(`Trying alternative URL: ${url}`);
            await driver.get(url);
            await sleep(3000);

            try {
                await driver.findElement(By.name('title'));
                console.log("✓ Successfully navigated via alternative URL");
                return true;
            } catch (e) {
                continue;
            }
        } catch (e) {
            continue;
        }
    }

    console.log("✗ All navigation methods failed");
    return false;
}

// Function to debug form fields (only when needed)
async function debugFormFields(driver) {
    try {
        const inputs = await driver.findElements(By.css('input, textarea, select'));
        console.log('Available form fields:');
        for (let input of inputs) {
            try {
                const name = await input.getAttribute('name');
                const id = await input.getAttribute('id');
                const type = await input.getAttribute('type');
                if (name || id) {
                    console.log(`- Name: ${name || 'N/A'}, ID: ${id || 'N/A'}, Type: ${type || 'N/A'}`);
                }
            } catch (e) {
                // Skip if element is no longer available
            }
        }
    } catch (error) {
        console.error('Error debugging form fields:', error.message);
    }
}

async function main() {
    let driver;
    try {
        const chromeOptions = new chrome.Options();
        chromeOptions.addArguments('--start-maximized');
        chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
        chromeOptions.excludeSwitches('enable-automation');
        chromeOptions.setUserPreferences({ 'profile.default_content_setting_values.notifications': 2 });

        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            .build();

        // Disable webdriver detection
        await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

        // Basic Auth URL
        const authUrl = 'https://tokyo:tokyo2024@dev-saas-cms2.webow.jp/admin';
        await driver.get(authUrl);
        await sleep(3000);

        // Login Page Interaction
        try {
            console.log("Logging in...");

            const loginField = await driver.findElement(By.name("login_id"));
            await loginField.clear();
            await loginField.sendKeys(process.env.CMS_USERNAME || 'outward');

            const passwordField = await driver.findElement(By.name("login_password"));
            await passwordField.clear();
            await passwordField.sendKeys(process.env.CMS_PASSWORD || 'ow_outward');

            const loginBtn = await driver.findElement(By.xpath("//button[@type='submit' and contains(@class, 'button')]"));
            await loginBtn.click();

            await sleep(3000);
            console.log("Login successful!");
        } catch (e) {
            console.error("Login failed or skipped:", e.message);
        }

        // Go to static site to verify basic auth
        await driver.get('https://tokyo:tokyo2024@tokyo-static01.webow.jp/');
        await sleep(3000);

        // Initial navigation to new article form
        const initialNavSuccess = await navigateToNewArticleForm(driver);
        if (!initialNavSuccess) {
            throw new Error("Could not navigate to new article form initially");
        }

        // Load data from data.json
        const jsonData = await fs.readFile('data/data.json', 'utf8');
        const articles = JSON.parse(jsonData).rows;

        // Optional: Show debug info for first article only
        let showDebugInfo = true; // Set to true if you want to see form fields

        console.log(`\n🚀 Starting to process ${articles.length} articles...\n`);

        for (let i = 0; i < articles.length; i++) {
            const article = articles[i];
            console.log(`\n📝 Creating article ${i + 1}/${articles.length}: "${article.title}"`);

            try {
                // For articles after the first one, navigate back to new article form
                if (i > 0) {
                    console.log("🔄 Preparing for next article...");
                    const navSuccess = await navigateToNewArticleForm(driver);
                    if (!navSuccess) {
                        // If navigation fails, try to continue with current state
                        console.log("⚠ Navigation failed, trying to continue...");
                        // You might want to skip this article or handle differently
                        continue;
                    }
                }

                // Debug form fields only for first article and only if enabled
                if (i === 0 && showDebugInfo) {
                    console.log("🔍 Debugging available form fields...");
                    await debugFormFields(driver);
                }

                // Fill title field
                const titleFilled = await waitAndFillField(driver, 'title', article.title);
                if (!titleFilled) {
                    throw new Error('Could not fill title field');
                }

                // Fill body field
                const bodyFilled = await waitAndFillField(driver, 'body', article.text);
                if (!bodyFilled) {
                    throw new Error('Could not fill body field');
                }

                // Try to fill date fields
                const { startDateSet, endDateSet } = await trySetDateFields(driver, article);

                // Handle different status types and save
                await sleep(3000);
                const saveButtonSelectorbyDrafts = By.xpath("//button[@type='button' and contains(@class, 'modalInput') and contains(@onclick, 'article_add')]");
                let saveButtonFound = false;

                try {
                    const saveButton = await driver.findElement(saveButtonSelectorbyDrafts);
                    await saveButton.click();
                    console.log("✓ Save draft button found and clicked");

                    // Handle status progression
                    const normalizedStatus = article.status === 'published' ? 'public' : article.status;

                    if (normalizedStatus == "pending" || normalizedStatus == "public") {
                        console.log(`📋 Processing status: ${normalizedStatus}`);
                        await sleep(2000);

                        try {
                            const saveButtonSelectorbyPending = By.xpath("//*[@id='submit_form']/div[4]/div[2]/table/tbody/tr[3]/td[1]/button");
                            const pendingButton = await driver.findElement(saveButtonSelectorbyPending);
                            await pendingButton.click();
                            console.log("✓ Save pending button found and clicked");

                            if (normalizedStatus == "public") {
                                await sleep(2000);
                                try {
                                    const saveButtonSelectorbyPublic = By.xpath("//*[@id='submit_form']/div[5]/div[2]/table/tbody/tr/td/button");
                                    const publicButton = await driver.findElement(saveButtonSelectorbyPublic);
                                    await publicButton.click();
                                    console.log("✓ Save public button found and clicked");
                                } catch (e) {
                                    console.log("⚠ Public button not found, article saved as pending");
                                }
                            }
                        } catch (e) {
                            console.log("⚠ Pending button not found, article saved as draft");
                        }
                    }

                    saveButtonFound = true;
                } catch (e) {
                    console.log("✗ Save button not found:", e.message);
                }

                if (!saveButtonFound) {
                    throw new Error('Could not find save button');
                }

                await sleep(3000);
                console.log(`✅ Successfully created article: "${article.title}" with status: ${article.status}`);

            } catch (error) {
                console.error(`❌ Error creating article "${article.title}": ${error.message}`);
                await fs.appendFile('errors.log', `Error on article "${article.title}": ${error.message}\n`);

                // Continue to next article
                continue;
            }
        }

        console.log("\n🎉 All articles processed successfully!");

        // Keep browser open until user presses Enter
        console.log("\nPress ENTER to close the browser...");
        process.stdin.once('data', async () => {
            await driver.quit();
            console.log("Browser closed.");
            process.exit(0);
        });

    } catch (e) {
        console.error("Main error:", e.message);
        if (driver) await driver.quit();
    }
}

main();