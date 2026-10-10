"""Manually test the Gemini-backed operator assistant."""

from api.assistant_backend import handle_operator_chat


if __name__ == "__main__":
    question = "Provide me a full breakdown of the missions and the takeaways. Make it short and simple"
    response = handle_operator_chat(question, raise_errors=True)
    print(response)
 