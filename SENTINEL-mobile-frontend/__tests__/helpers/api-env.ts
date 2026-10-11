// Imported before App so its module-level repository choice sees the API URL.
export const API_URL = "http://localhost:8000";
process.env.EXPO_PUBLIC_API_URL = API_URL;
