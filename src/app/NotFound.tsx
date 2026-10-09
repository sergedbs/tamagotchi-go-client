import { Link } from 'react-router'

export function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>This address does not match a Tamagotchi Go screen.</p>
      <Link to="/creatures">Go to your creatures</Link>
    </main>
  )
}
