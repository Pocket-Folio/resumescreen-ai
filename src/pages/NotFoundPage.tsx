import { Link } from "react-router";
import { Compass } from "lucide-react";
import { EmptyState } from "../components/ui/States";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<Compass />}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      action={<Link to="/"><Button variant="primary">Go to dashboard</Button></Link>}
    />
  );
}
