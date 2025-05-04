/**
 * Example component to demonstrate mono-jsx usage
 */

// Simple component that takes props
export const Greeting = ({ name }: { name: string }) => {
  return <div>Hello, {name}!</div>;
};

// Component with children
export const Container = ({ children }: { children: unknown }) => {
  return (
    <div class="container">
      {children}
    </div>
  );
};

// Component with conditional rendering
export const ConditionalContent = ({ condition, content }: { condition: boolean; content: string }) => {
  return condition ? <div>{content}</div> : null;
};

// Example of how to use these components
export const ExampleUsage = () => {
  return (
    <Container>
      <Greeting name="World" />
      <ConditionalContent condition={true} content="This content is visible" />
      <ConditionalContent condition={false} content="This content is hidden" />
    </Container>
  );
};
