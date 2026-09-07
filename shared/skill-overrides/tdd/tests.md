# Test Design Examples

Prefer behavior a caller relies on:

```typescript
test("totals line-item prices", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

The expected result is independently known. Recomputing it with the same algorithm
as the implementation would not provide independent evidence.

Choose a stable observation point. A user-creation test can retrieve the created
user through the public interface. A persistence integration test may legitimately
inspect stored records when durable storage itself is the contract.

Multiple related assertions can verify one behavior. Call order or counts matter
when they are part of the actual protocol, but assertions about incidental internal
calls often make tests fragile.

Use the smallest realistic arrangement that can detect the failure. A test of a
helper is insufficient when the bug depends on multiple consumers or an integration.
