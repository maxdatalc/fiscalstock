import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FiscalStock MaxData" },
      { name: "description", content: "Compare estoque físico e fiscal antes de emitir notas ou lançar itens em O.S." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
