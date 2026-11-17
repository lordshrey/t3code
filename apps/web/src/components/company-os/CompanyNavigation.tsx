import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { scopedProjectKey, scopeProjectRef } from "@t3tools/client-runtime/environment";
import { HouseIcon, Columns3Icon } from "lucide-react";
import * as Schema from "effect/Schema";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "../ui/sidebar";

const productSchema = Schema.NullOr(Schema.String);

export function CompanyNavigation() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const search = useSearch({ strict: false });
  const { activeThread, activeDraftThread } = useHandleNewThread();
  const context = activeThread ?? activeDraftThread;
  const [lastProduct, setLastProduct] = useLocalStorage<string | null, string | null>(
    "company-os:dashboard-product",
    null,
    productSchema,
  );
  const product = context
    ? scopedProjectKey(scopeProjectRef(context.environmentId, context.projectId))
    : (search.product ?? lastProduct ?? undefined);
  const { isMobile, setOpenMobile } = useSidebar();
  const boardOpen = search.page === "tasks" || search.page === "workflow";
  const navigate = () => {
    if (product) setLastProduct(product);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <nav aria-label="Workspace navigation" className="mb-3">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/" && !boardOpen}
            render={<Link to="/" search={{ product, page: "home" }} onClick={navigate} />}
          >
            <HouseIcon />
            <span>Home</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname === "/" && boardOpen}
            render={<Link to="/" search={{ product, page: "tasks" }} onClick={navigate} />}
          >
            <Columns3Icon />
            <span>Task board</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </nav>
  );
}
