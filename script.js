const typingForm = document.querySelector(".typing-form");
const chatList = document.querySelector(".chat-list");
const changeThemeBtn = document.querySelector("#change-theme-btn");
const deleteChatBtn = document.querySelector("#delete-chat-btn")

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',         // Replace with your PostgreSQL username
  host: 'localhost',            // Or your database's host address
  database: 'demo-up-budget',    // Replace with your database name
  password: '8916',    // Replace with your PostgreSQL password
  port: 5432,                   // Default PostgreSQL port
});

let userMessage = null;
let jsonData = null;

const jsonFiles = ['./01.json', './02.json', './03.json', './04.json', './05.json', './06.json'];
const openaiAPIKey = ""; // Keep your API key private
const apiEndpoint = "https://api.openai.com/v1/chat/completions";

const loadLocalStorageData = () => {
  const savedMessages = localStorage.getItem("savedMessages");
  const isLightMode = (localStorage.getItem("themeColor") === "light_mode");

  // Load the saved theme
  document.body.classList.toggle("light_mode", isLightMode);
  changeThemeBtn.innerText = isLightMode ? "dark_mode" : "light_mode";

  // Load the saved messages
  chatList.innerHTML = savedMessages || "";

  document.body.classList.toggle("hide-header", savedMessages);
  chatList.scrollTo(0, chatList.scrollHeight);
}

loadLocalStorageData();

// Redirect to the PDF link
function redirectToPDF() {
  const pdfLink = "https://www.dbm.gov.ph/wp-content/uploads/NEP2024/SUCS/A/A8.pdf";
  window.open(pdfLink, "_blank");
}

async function loadJsonFiles() {
  try {
    const jsonPromises = jsonFiles.map(async (file) => {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to load ${file}: ${response.statusText}`);
      }
      return response.json();
    });

    // Wait for all JSON files to load and merge them
    const jsonDataArray = await Promise.all(jsonPromises);
    jsonData = Object.assign({}, ...jsonDataArray); // Merge JSON objects
    console.log("Loaded JSON Data:", jsonData);
  } catch (error) {
    console.error("Error loading JSON files:", error);
  }
}

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
}

// Ask a question to OpenAI using the JSON data
const askQuestion = async (incomingMessageDiv) => {
  const responseElement = incomingMessageDiv.querySelector(".text");

  // Fetch logs related to the current query
  const relevantLogs = await fetchRelevantLogs(userMessage);

  const modifiedQuestion = `
    Using the following past knowledge, answer the user's query:
    ${relevantLogs}

    User Query: ${userMessage}
    Combined Data Context: ${JSON.stringify(jsonData, null, 2)}
  `;

  try {
    const aiResponse = await openAiRequest(modifiedQuestion);
    showTypingEffect(aiResponse, responseElement, incomingMessageDiv);
  } catch (error) {
    console.error("Error while fetching the AI response:", error);
    responseElement.innerText = "Error: Unable to get a response from the AI.";
  }
};

// Make a request to OpenAI API (using chat/completions)
async function openAiRequest(modifiedQuestion) {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
  
    // Create the prompt
    const prompt = `Question and Context: ${modifiedQuestion}`;
  
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiAPIKey}`, 
        },
        body: JSON.stringify({
          model: "gpt-4-turbo", 
          messages: [{ role: "user", content: prompt }], 
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response from OpenAI:", errorData);
        return `Error: ${errorData.error.message}`;
      }
  
      const data = await response.json();
      if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content.trim();
      } else {
        return "No response received from OpenAI.";
      }
    } catch (error) {
      console.error("Error with OpenAI API request:", error);
      return "There was an error processing your request. Please try again.";
    }
}

const fetchRelevantLogs = async (query) => {
  try {
    const result = await pool.query(
      "SELECT response FROM query_logs WHERE query ILIKE $1 ORDER BY timestamp DESC LIMIT 5",
      [`%${query}%`]
    );
    return result.rows.map(row => row.response).join("\n");
  } catch (error) {
    console.error("Error fetching logs:", error);
    return ""; // Return an empty string if there's an error
  }
};

// Show a loading animation while waiting for the API response
const showLoadingAnimation = () => {
  const html = `<div class="message-content">
                  <img src="./resources/company-logo.png" alt="UP logo" class="avatar">
                  <p class="text"></p>
                  <div class="loading-indicator">
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                    <div class="loading-bar"></div>
                  </div>
                </div>
                <span onclick="copyMessage(this)" class="icon material-symbols-rounded">content_copy</span>`;
  
  const incomingMessageDiv = createMessageElement(html, "incoming", "loading");
  chatList.appendChild(incomingMessageDiv);

  chatList.scrollTo(0, chatList.scrollHeight);
  askQuestion(incomingMessageDiv);
}

const copyMessage = (copyIcon) => {
  const messageText = copyIcon.parentElement.querySelector(".text").innerText;

  navigator.clipboard.writeText(messageText);
  copyIcon.innerText = "done";
  setTimeout(() => copyIcon.innerText = "content_copy", 1000);
}

const handleOutgoingChat = () => {
  userMessage = typingForm.querySelector(".typing-input").value.trim();
  if(!userMessage) return // Exit if there is no message

  const html = `<div class="message-content">
                  <img src="./resources/account-pic.svg" alt="User icon" class="avatar">
                  <p class="text"></p>    
                </div>`;
  
  const outgoingMessageDiv = createMessageElement(html, "outgoing");
  outgoingMessageDiv.querySelector(".text").innerText = userMessage;
  chatList.appendChild(outgoingMessageDiv);

  typingForm.reset(); // Clear input field
  chatList.scrollTo(0, chatList.scrollHeight);
  document.body.classList.add("hide-header");
  setTimeout(showLoadingAnimation, 500); // Show loading animation after a delay
}

// Prevent default form submission and handle outgoing chat
typingForm.addEventListener("submit", (e) => {
  e.preventDefault();

  handleOutgoingChat();
})

const showTypingEffect = (text, responseElement, incomingMessageDiv) => {
  const words = text.split(' ');
  let currentWordIndex = 0;

  const typingInterval = setInterval(() => {
    // Append each word to the text element with a space
    responseElement.innerText += (currentWordIndex === 0 ? '' : ' ') +words[currentWordIndex++];
    incomingMessageDiv.querySelector(".icon").classList.add("hide");

    // If all words are displayed
    if(currentWordIndex === words.length) {
      clearInterval(typingInterval);
      incomingMessageDiv.querySelector(".icon").classList.remove("hide");
      localStorage.setItem("savedMessages", chatList.innerHTML);
      chatList.scrollTo(0, chatList.scrollHeight); 
    }
  }, 75);
}

changeThemeBtn.addEventListener("click", () => {
  const isLightMode = document.body.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightMode ? "light_mode" : "dark_mode");
  changeThemeBtn.innerText = isLightMode ? "dark_mode" : "light_mode";
});

deleteChatBtn.addEventListener("click", () => {
  if(confirm("Delete all messages?")) {
    localStorage.removeItem("savedMessages");
    loadLocalStorageData();
  }
});

const fs = require('fs').promises;

const readFeedbackData = async () => {
  try {
    const data = await fs.readFile('./feedback.json', 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading feedback.json:', error);
    return { logs: [] }; // Return an empty structure if the file doesn't exist
  }
};

const writeFeedbackData = async (data) => {
  try {
    await fs.writeFile('./feedback.json', JSON.stringify(data, null, 2), 'utf-8');
    console.log('Feedback data updated successfully.');
  } catch (error) {
    console.error('Error writing to feedback.json:', error);
  }
};

const updateFeedback = async (id, isAccurate, correctedResponse) => {
  const data = await readFeedbackData();

  const log = data.logs.find((entry) => entry.id === id);
  if (log) {
    log.isAccurate = isAccurate;
    if (correctedResponse) log.correctedResponse = correctedResponse;
    log.timestamp = new Date().toISOString(); // Update the timestamp
  } else {
    console.error('Log entry not found for ID:', id);
  }

  await writeFeedbackData(data);
};

const fetchCorrectedResponse = async (query) => {
  const data = await readFeedbackData();
  const log = data.logs.find(
    (entry) => entry.query.toLowerCase() === query.toLowerCase() && entry.correctedResponse
  );
  return log ? log.correctedResponse : null;
};

const processQuestion = async (userMessage) => {
  const correctedResponse = await fetchCorrectedResponse(userMessage);

  const finalResponse = correctedResponse || (await openAiRequest(userMessage));
  console.log('Final Response:', finalResponse);
};

// Load the JSON file immediately after the page is loaded
window.onload = loadJsonFiles;