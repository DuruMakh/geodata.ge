import { currentGroup, type GroupId } from "../../lib/navigation/navTree";

/** Where the rail preference is stored: "1" collapsed, "0" expanded. */
export const SIDEBAR_STORAGE_KEY = "geodata:sidebar-collapsed";
export const SIDEBAR_NAV_ID = "data-sidebar-navigation";
/** The style the pre-paint script adds; the sidebar removes it once it has drawn the stored state itself. */
export const PRE_PAINT_RAIL_STYLE_ID = "sidebar-rail-before-hydration";

/**
 * Run inline before the sidebar is parsed (lib/pages/explorer-layout.tsx). The server cannot read the stored collapse, so
 * without this a reader who collapsed the sidebar sees 272px and the page jumps 200px left once the sidebar has mounted.
 * It reserves the 72px rail from the first paint, blank until the sidebar draws it. A style in <head>, not an attribute on
 * an element React hydrates, so hydration finds what it rendered.
 */
export const PRE_PAINT_RAIL_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(SIDEBAR_STORAGE_KEY)})==="1"){var s=document.createElement("style");s.id=${JSON.stringify(PRE_PAINT_RAIL_STYLE_ID)};s.textContent="@media (min-width:900px){#${SIDEBAR_NAV_ID}[data-collapsed=false]{width:72px}#${SIDEBAR_NAV_ID}[data-collapsed=false]>*{visibility:hidden}}";document.head.appendChild(s)}}catch(e){}`;

/**
 * The explorer sidebar's state (spec 2026-10-24-explorer-regroup §4). `page` is the address the open groups were last
 * brought up to date for; `desktop` stays `null` until the browser has measured the width.
 */
export type SidebarState = {
  page: string;
  /** The expanded groups: the current group on arrival, plus any the reader opened, until they close them. */
  open: ReadonlySet<GroupId>;
  /** The stored collapse preference; it draws the rail only from 900px. */
  collapsed: boolean;
  desktop: boolean | null;
  /** The full-screen menu below 900px. */
  menu: boolean;
  /** The group whose pop-out shows beside the rail. */
  fly: GroupId | null;
};

export type SidebarAction =
  | { type: "navigate"; page: string }
  | { type: "toggleGroup"; id: GroupId }
  | { type: "collapse"; collapsed: boolean }
  | { type: "width"; desktop: boolean }
  | { type: "menu"; open: boolean }
  | { type: "fly"; id: GroupId | null };

/** A page's group, added to the open set. */
function withCurrent(open: ReadonlySet<GroupId>, page: string): ReadonlySet<GroupId> {
  const group = currentGroup(page);
  return !group || open.has(group.id) ? open : new Set([...open, group.id]);
}

export function initialSidebarState(page: string): SidebarState {
  return { page, open: withCurrent(new Set(), page), collapsed: false, desktop: null, menu: false, fly: null };
}

/** The rail is a desktop posture: a collapse stored on a laptop does not narrow a phone's menu. */
export function isRailed(state: SidebarState): boolean {
  return state.collapsed && state.desktop === true;
}

export function sidebarReducer(state: SidebarState, action: SidebarAction): SidebarState {
  switch (action.type) {
    case "navigate":
      // A link was followed, from the menu or a pop-out: both close, and the new page's group opens.
      return { ...state, page: action.page, open: withCurrent(state.open, action.page), menu: false, fly: null };
    case "toggleGroup": {
      const open = new Set(state.open);
      if (!open.delete(action.id)) open.add(action.id);
      return { ...state, open };
    }
    case "collapse":
      return { ...state, collapsed: action.collapsed, fly: null };
    case "width":
      // A menu opened on a phone must not survive into the desktop sidebar, which it would hide the page beside, and a
      // pop-out belongs to the rail it hung from (Review Focus 5).
      if (state.desktop === action.desktop) return state;
      return { ...state, desktop: action.desktop, menu: action.desktop ? false : state.menu, fly: null };
    case "menu":
      return state.menu === action.open ? state : { ...state, menu: action.open };
    case "fly": {
      const fly = isRailed(state) ? action.id : null;
      return state.fly === fly ? state : { ...state, fly };
    }
  }
}
