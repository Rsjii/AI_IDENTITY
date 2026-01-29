export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 p-3">
      <div 
        className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" 
        style={{ 
          animationDelay: '0ms',
          animationDuration: '1.4s',
          animationIterationCount: 'infinite'
        }} 
      />
      <div 
        className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" 
        style={{ 
          animationDelay: '200ms',
          animationDuration: '1.4s',
          animationIterationCount: 'infinite'
        }} 
      />
      <div 
        className="w-2 h-2 bg-accent-primary rounded-full animate-bounce" 
        style={{ 
          animationDelay: '400ms',
          animationDuration: '1.4s',
          animationIterationCount: 'infinite'
        }} 
      />
    </div>
  );
}


