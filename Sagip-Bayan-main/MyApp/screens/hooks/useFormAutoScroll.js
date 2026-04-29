import { useRef } from "react";

export default function useFormAutoScroll(offset = 28) {
  const scrollRef = useRef(null);
  const inputPositions = useRef({});

  const registerInput = (key) => (event) => {
    inputPositions.current[key] = event.nativeEvent.layout.y;
  };

  const scrollToInput = (key) => {
    const y = inputPositions.current[key] || 0;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - offset),
        animated: true,
      });
    });
  };

  return {
    scrollRef,
    registerInput,
    scrollToInput,
  };
}
