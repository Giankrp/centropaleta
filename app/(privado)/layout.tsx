import type { ReactNode } from "react";
import "../../public/panel.css";
import "../../public/avatars.css";
import "../../public/upgrade.css";
import "./privado.css";

export default function LayoutPrivado({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
