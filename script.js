let jsonData = null;

const jsonFiles = ['./1.json', './2.json', './3.json', './4.json', './5.json', './6.json', './7.json', './8.json'];
const openaiAPIKey = ""; // Keep your API key private
const apiEndpoint = "https://api.openai.com/v1/chat/completions";

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

function updateHistory(question, answer) {
  const chatHistoryContainer = document.getElementById("chatHistory");
  
  // Create and append new message (Question)
  const userMessageDiv = document.createElement("div");
  userMessageDiv.classList.add("chatMessage", "userMessage");
  userMessageDiv.textContent = `You: ${question}`;
  chatHistoryContainer.appendChild(userMessageDiv);

  // Create and append new message (Answer)
  const botMessageDiv = document.createElement("div");
  botMessageDiv.classList.add("chatMessage", "botMessage");
  botMessageDiv.textContent = `Bot: ${answer}`;
  chatHistoryContainer.appendChild(botMessageDiv);

  // Scroll to the bottom of the chat history
  chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
}

// Ask a question to OpenAI using the JSON data

async function askQuestion() {
  const question = document.getElementById("userInput").value;
  const responseElement = document.getElementById("responseContainer");

  // Show loading spinner or message
  responseElement.textContent = "Loading...";

  // Check if jsonData is loaded
  if (!jsonData || Object.keys(jsonData).length === 0) {
    responseElement.textContent = "JSON files are not loaded properly. Please ensure all files are accessible.";
    return;
  }

  // Instructional text to include in the prompt
  const instructionalText = "Please use the combined data from all JSON files as context when answering the question. Answer by using the JSON document as main reference, unless it is absolutely out of context; for example, if the prompt is just a simple greeting. Answer in a concise, clear, and professional manner. You may opt not to answer in complete sentences. Be empathetic only when necessary. \n\n'";

  // Combine the user's input, instructional text, and JSON content
  const jsonContent = JSON.stringify(jsonData, null, 2); // Pretty-print JSON for readability
  const modifiedQuestion = `${question}\n\n${instructionalText}\n\n${jsonContent}`;

  try {
    // Send the modified question to OpenAI
    const aiResponse = await openAiRequest(modifiedQuestion);

    // Assuming openAiRequest returns the response in a usable format
    responseElement.innerText = aiResponse || "No response from OpenAI.";
    updateHistory(question, aiResponse);
  } catch (error) {
    console.error("Error while fetching the AI response:", error);
    responseElement.innerText = "Error: Unable to get a response from the AI.";
  } finally {
    loadingSpinner.style.display = "none"; // Hide loading spinner
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
          model: "gpt-3.5-turbo", // Use the appropriate model
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

// Load the JSON file immediately after the page is loaded
window.onload = loadJsonFiles;