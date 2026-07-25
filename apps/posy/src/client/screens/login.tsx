export function LoginScreen() {
  return (
    <main>
      <h1>Posy</h1>
      <p>Enter your pairing code</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <input
          aria-label="Pairing code"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="000000"
        />
        <button type="submit">Pair</button>
      </form>
    </main>
  );
}
