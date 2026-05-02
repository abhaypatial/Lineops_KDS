import { useState, useEffect } from "react";

export function useStoreContext() {
  const [storeId, setStoreId] = useState<string>("");
  
  // In a real app, this might come from auth or a global store selector.
  // For now, we'll try to use the first store if one exists, or let the user select it.
  
  return {
    storeId,
    setStoreId
  };
}
