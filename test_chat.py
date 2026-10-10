"""Manually test the Gemini-backed operator assistant."""

from api.assistant_backend import handle_operator_chat


if __name__ == "__main__":
    question = "Which inspection types appear least reliable based on our synthetic data?"
    response = handle_operator_chat(question, raise_errors=True)
    print(response)
