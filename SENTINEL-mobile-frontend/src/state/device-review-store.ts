import AsyncStorage from "@react-native-async-storage/async-storage";
import { createReviewStore } from "./review-store";

/** Create once per repository namespace when composing the app. */
export function createDeviceReviewStore(namespace: string) {
  return createReviewStore(AsyncStorage, namespace);
}
