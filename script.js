const typingForm = document.querySelector(".typing-form");
const chatList = document.querySelector(".chat-list");
const changeThemeBtn = document.querySelector("#change-theme-btn");
const deleteChatBtn = document.querySelector("#delete-chat-btn")

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
  const responseElement = incomingMessageDiv.querySelector(".text"); // Get text element

  // Check if jsonData is loaded
  if (!jsonData || Object.keys(jsonData).length === 0) {
    responseElement.textContent = "JSON files are not loaded properly. Please ensure all files are accessible.";
    return;
  }

  // Instructional text to include in the prompt
  const instructionalText = "Answer using the provided JSON data. Be clear and concise. Unless otherwise stated, use 2025 data to answer questions. \n\n'";

  // Combine the user's input, instructional text, and JSON content
  const jsonContent = JSON.stringify(jsonData, null, 2); // Pretty-print JSON for readability
  const modifiedQuestion = `${userMessage}\n\n${instructionalText}\n\n${jsonContent}`;

  try {
    // Send the modified question to OpenAI
    const aiResponse = await openAiRequest(modifiedQuestion);
    

    // Assuming openAiRequest returns the response in a usable format
    // responseElement.innerText = aiResponse || "No response from OpenAI.";
    showTypingEffect(aiResponse, responseElement, incomingMessageDiv);

  } catch (error) {
    console.error("Error while fetching the AI response:", error);
    responseElement.innerText = "Error: Unable to get a response from the AI.";
  } finally {
    incomingMessageDiv.classList.remove("loading"); // Hide loading
  }
}

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
          Authorization: `Bearer ${openaiAPIKey}`, // Use a securely stored API key
        },
        body: JSON.stringify({
          model: "ft:gpt-3.5-turbo-1106:personal:demoupbudget:AsqyyR3Z", // Use the appropriate model
          messages: [{ role: "user", content: prompt }], // Correct usage of 'messages'
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



// Load the JSON file immediately after the page is loaded
window.onload = loadJsonFiles;