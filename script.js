const typingForm = document.querySelector(".typing-form");
const chatList = document.querySelector(".chat-list");
const changeThemeBtn = document.querySelector("#change-theme-btn");
const deleteChatBtn = document.querySelector("#delete-chat-btn")

let userMessage = null;
let jsonData = null;
let embeddings = null;

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
  console.log("Local Storage Data loaded.");
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

const loadEmbeddings = async () => {
  try {
    const response = await fetch('./embeddings.json'); // Fetch the file from the server
    console.log("Embeddings file fetching initialized.");
    if (!response.ok) {
      throw new Error(`Failed to load embeddings.json: ${response.statusText}`);
    }
    embeddings = await response.json(); // Parse JSON directly
    console.log("Embeddings loaded successfully:", embeddings);
  } catch (error) {
    console.error("Error loading embeddings:", error);
    embeddings = {}; // Fallback to an empty object
  }
};

window.onload = async () => {
  document.body.classList.add("loading"); // Add a loading class
  await loadEmbeddings(); // Load embeddings for RAG
  await loadJsonFiles(); // Load and merge all JSON files
  document.body.classList.remove("loading"); // Remove loading class
  loadLocalStorageData(); // Ensure saved messages and theme are loaded
};

const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
};

const retrieveRelevantFiles = async (userQuery, embeddings) => {
  try {
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiAPIKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: userQuery,
      }),
    });

    const queryEmbedding = (await embeddingResponse.json()).data[0].embedding;

    // Compare query embedding with file embeddings
    const scores = Object.entries(embeddings).map(([file, embedding]) => ({
      file,
      score: cosineSimilarity(queryEmbedding, embedding),
    }));

    // Filter and sort by score
    const relevantScores = scores
      .filter(score => score.score > 0.5) // Filter by threshold
      .sort((a, b) => b.score - a.score); // Sort by descending score

    // Return top 3 files, or empty array if none match
    return relevantScores.slice(0, 3).map(score => score.file);
  } catch (error) {
    console.error("Error retrieving relevant files:", error);
    return [];
  }
};

const appendRelevantJsonToPrompt = async (userQuery) => {
  try {
    // Retrieve the most relevant file
    const relevantFiles = await retrieveRelevantFiles(userQuery, embeddings);

    if (relevantFiles.length === 0) {
      console.log("No relevant files found for the query.");
      return null;
    }

    // Load the content of the most relevant file
    const fileContent = await fs.readFile(relevantFiles[0], 'utf-8');
    const jsonData = JSON.parse(fileContent);

    console.log(`Appending data from ${relevantFiles[0]} to the prompt.`);

    // Flatten or process JSON as needed (optional)
    const flattenedJson = JSON.stringify(jsonData);

    // Construct the final prompt
    const instructionalText = "Answer the user's question using the provided reference data.";
    const finalPrompt = `${userQuery}\n\nReference Data:\n${flattenedJson}\n\n${instructionalText}`;

    return finalPrompt;
  } catch (error) {
    console.error("Error appending relevant JSON to prompt:", error);
    return null;
  }
};

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
}

// Ask a question to OpenAI using the JSON data
const askQuestion = async (incomingMessageDiv, userMessage) => {
  const responseElement = incomingMessageDiv.querySelector(".text");

  if (!embeddings || Object.keys(embeddings).length === 0) {
    responseElement.textContent = "Embeddings are not ready. Please wait.";
    return;
  }

  try {
    // Retrieve the most relevant files using RAG
    const relevantFiles = await retrieveRelevantFiles(userMessage, embeddings);
    let jsonContent;

    if (relevantFiles.length === 0) {
      console.log("No relevant files found. Falling back to merged data.");
      jsonContent = JSON.stringify(jsonData, null, 2); // Use preloaded merged data
    } else {
      const relevantData = await Promise.all(relevantFiles.map(async (file) => {
        const response = await fetch(file);
        return response.json();
      }));
      jsonContent = relevantData.map(data => JSON.stringify(data)).join("\n");
    }

    // Construct the prompt
    const instructionalText = "Answer using the provided JSON data. Be clear and concise. Unless otherwise stated, use 2025 data to answer questions.";
    const prompt = `${userMessage}\n\n${instructionalText}\n\n${jsonContent}`;

    // Send the prompt to OpenAI and handle the response
    const aiResponse = await openAiRequest(prompt);
    showTypingEffect(aiResponse, responseElement, incomingMessageDiv);
  } catch (error) {
    console.error("Error:", error);
    responseElement.textContent = "Error processing your request.";
  } finally {
    incomingMessageDiv.classList.remove("loading");
  }
};

// Make a request to OpenAI API (using chat/completions)
async function openAiRequest(prompt) {
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  try {
    // Send the query to OpenAI
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiAPIKey}`, // Replace with your OpenAI API key
      },
      body: JSON.stringify({
        model: "gpt-4-turbo", // Adjust model as needed
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error response from OpenAI:", errorData);
      return `Error: ${errorData.error.message}`;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content.trim();
    console.log("AI Response:", aiResponse);
    return aiResponse;
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return "Error processing your request.";
  }
}

// Show a loading animation while waiting for the API response
const showLoadingAnimation = (userMessage) => {
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
  
  // Pass userMessage to askQuestion
  askQuestion(incomingMessageDiv, userMessage);
};

const copyMessage = (copyIcon) => {
  const messageText = copyIcon.parentElement.querySelector(".text").innerText;

  navigator.clipboard.writeText(messageText);
  copyIcon.innerText = "done";
  setTimeout(() => copyIcon.innerText = "content_copy", 1000);
}

const handleOutgoingChat = () => {
  userMessage = typingForm.querySelector(".typing-input").value.trim();
  if (!userMessage) return; // Exit if there is no message

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
  setTimeout(() => showLoadingAnimation(userMessage), 500); // Pass userMessage
};

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