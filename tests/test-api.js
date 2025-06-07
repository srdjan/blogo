// Simple script to test the API endpoint
const url = "http://localhost:8000/api/posts";
const data = {
  title: "Test Post from JavaScript",
  content: "# Test Post\n\nThis is a test post created via the API.",
  tags: ["test", "api"],
};

console.log("Sending POST request to:", url);
console.log("With data:", JSON.stringify(data, null, 2));

fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
})
  .then((response) => {
    console.log("Status:", response.status);
    console.log("Status Text:", response.statusText);
    console.log("Headers:", Object.fromEntries([...response.headers]));
    return response.text();
  })
  .then((text) => {
    console.log("Response body:", text);
    try {
      const json = JSON.parse(text);
      console.log("Parsed JSON:", json);
    } catch (e) {
      console.log("Response is not valid JSON");
    }
  })
  .catch((error) => {
    console.error("Error:", error);
  });
