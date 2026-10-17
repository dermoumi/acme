import { redirect } from "react-router";

export function loader() {
  return redirect("/");
}

// Never shown, but without it this URL can render no error page.
export default function Unknown() {
  return null;
}
