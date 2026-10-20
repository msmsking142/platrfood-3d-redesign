import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { GlobalContextProviders } from "./components/_globalContextProviders";
import Page_0 from "./pages/_index.tsx";
import PageLayout_0 from "./pages/_index.pageLayout.tsx";
import Page_1 from "./pages/login.tsx";
import PageLayout_1 from "./pages/login.pageLayout.tsx";
import Page_2 from "./pages/r.$restaurantId.tsx";
import PageLayout_2 from "./pages/r.$restaurantId.pageLayout.tsx";
import Page_3 from "./pages/orders.tsx";
import PageLayout_3 from "./pages/orders.pageLayout.tsx";
import Page_4 from "./pages/partner.tsx";
import PageLayout_4 from "./pages/partner.pageLayout.tsx";
import Page_5 from "./pages/rider.tsx";
import PageLayout_5 from "./pages/rider.pageLayout.tsx";
import Page_6 from "./pages/ordersContent.tsx";
import PageLayout_6 from "./pages/ordersContent.pageLayout.tsx";
import Page_7 from "./pages/partnerContent.tsx";
import PageLayout_7 from "./pages/partnerContent.pageLayout.tsx";
import Page_8 from "./pages/riderContent.tsx";
import PageLayout_8 from "./pages/riderContent.pageLayout.tsx";
import Page_9 from "./pages/admin.tsx";
import PageLayout_9 from "./pages/admin.pageLayout.tsx";
import Page_10 from "./pages/support.tsx";
import PageLayout_10 from "./pages/support.pageLayout.tsx";
import Page_11 from "./pages/menu-editor.tsx";
import PageLayout_11 from "./pages/menu-editor.pageLayout.tsx";
import Page_12 from "./pages/terms.tsx";
import PageLayout_12 from "./pages/terms.pageLayout.tsx";
import Page_13 from "./pages/account.tsx";
import PageLayout_13 from "./pages/account.pageLayout.tsx";
import Page_14 from "./pages/account.wallet.tsx";
import PageLayout_14 from "./pages/account.wallet.pageLayout.tsx";
import Page_15 from "./pages/account.payments.tsx";
import PageLayout_15 from "./pages/account.payments.pageLayout.tsx";
import Page_16 from "./pages/account.addresses.tsx";
import PageLayout_16 from "./pages/account.addresses.pageLayout.tsx";
import Page_17 from "./pages/privacy-policy.tsx";
import PageLayout_17 from "./pages/privacy-policy.pageLayout.tsx";
import Page_18 from "./pages/delete-account.tsx";
import PageLayout_18 from "./pages/delete-account.pageLayout.tsx";

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (cb) => {
    setTimeout(cb, 1);
  };
}

import "./base.css";

const fileNameToRoute = new Map([["./pages/_index.tsx","/"],["./pages/login.tsx","/login"],["./pages/r.$restaurantId.tsx","/r/:restaurantId"],["./pages/orders.tsx","/orders"],["./pages/partner.tsx","/partner"],["./pages/rider.tsx","/rider"],["./pages/ordersContent.tsx","/ordersContent"],["./pages/partnerContent.tsx","/partnerContent"],["./pages/riderContent.tsx","/riderContent"],["./pages/admin.tsx","/admin"],["./pages/support.tsx","/support"],["./pages/menu-editor.tsx","/menu-editor"],["./pages/terms.tsx","/terms"],["./pages/account.tsx","/account"],["./pages/account.wallet.tsx","/account/wallet"],["./pages/account.payments.tsx","/account/payments"],["./pages/account.addresses.tsx","/account/addresses"],["./pages/privacy-policy.tsx","/privacy-policy"],["./pages/delete-account.tsx","/delete-account"]]);
const fileNameToComponent = new Map([
    ["./pages/_index.tsx", Page_0],
["./pages/login.tsx", Page_1],
["./pages/r.$restaurantId.tsx", Page_2],
["./pages/orders.tsx", Page_3],
["./pages/partner.tsx", Page_4],
["./pages/rider.tsx", Page_5],
["./pages/ordersContent.tsx", Page_6],
["./pages/partnerContent.tsx", Page_7],
["./pages/riderContent.tsx", Page_8],
["./pages/admin.tsx", Page_9],
["./pages/support.tsx", Page_10],
["./pages/menu-editor.tsx", Page_11],
["./pages/terms.tsx", Page_12],
["./pages/account.tsx", Page_13],
["./pages/account.wallet.tsx", Page_14],
["./pages/account.payments.tsx", Page_15],
["./pages/account.addresses.tsx", Page_16],
["./pages/privacy-policy.tsx", Page_17],
["./pages/delete-account.tsx", Page_18],
  ]);

function makePageRoute(filename: string) {
  const Component = fileNameToComponent.get(filename);
  return <Component />;
}

function toElement({
  trie,
  fileNameToRoute,
  makePageRoute,
}: {
  trie: LayoutTrie;
  fileNameToRoute: Map<string, string>;
  makePageRoute: (filename: string) => React.ReactNode;
}) {
  return [
    ...trie.topLevel.map((filename) => (
      <Route
        key={fileNameToRoute.get(filename)}
        path={fileNameToRoute.get(filename)}
        element={makePageRoute(filename)}
      />
    )),
    ...Array.from(trie.trie.entries()).map(([Component, child], index) => (
      <Route
        key={index}
        element={
          <Component>
            <Outlet />
          </Component>
        }
      >
        {toElement({ trie: child, fileNameToRoute, makePageRoute })}
      </Route>
    )),
  ];
}

type LayoutTrieNode = Map<
  React.ComponentType<{ children: React.ReactNode }>,
  LayoutTrie
>;
type LayoutTrie = { topLevel: string[]; trie: LayoutTrieNode };
function buildLayoutTrie(layouts: {
  [fileName: string]: React.ComponentType<{ children: React.ReactNode }>[];
}): LayoutTrie {
  const result: LayoutTrie = { topLevel: [], trie: new Map() };
  Object.entries(layouts).forEach(([fileName, components]) => {
    let cur: LayoutTrie = result;
    for (const component of components) {
      if (!cur.trie.has(component)) {
        cur.trie.set(component, {
          topLevel: [],
          trie: new Map(),
        });
      }
      cur = cur.trie.get(component)!;
    }
    cur.topLevel.push(fileName);
  });
  return result;
}

function NotFound() {
  return (
    <div>
      <h1>Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>Go back to the <a href="/" style={{ color: 'blue' }}>home page</a>.</p>
    </div>
  );
}

import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollManager() {
  const { pathname, search, hash } = useLocation();
  const navType = useNavigationType(); // "PUSH" | "REPLACE" | "POP"

  useEffect(() => {
    // Back/forward: keep browser-like behavior
    if (navType === "POP") return;

    // Hash links: let the browser scroll to the anchor
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, search, hash, navType]);

  return null;
}

export function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
      <ScrollManager />
      <GlobalContextProviders>
        <Routes>
          {toElement({ trie: buildLayoutTrie({
"./pages/_index.tsx": PageLayout_0,
"./pages/login.tsx": PageLayout_1,
"./pages/r.$restaurantId.tsx": PageLayout_2,
"./pages/orders.tsx": PageLayout_3,
"./pages/partner.tsx": PageLayout_4,
"./pages/rider.tsx": PageLayout_5,
"./pages/ordersContent.tsx": PageLayout_6,
"./pages/partnerContent.tsx": PageLayout_7,
"./pages/riderContent.tsx": PageLayout_8,
"./pages/admin.tsx": PageLayout_9,
"./pages/support.tsx": PageLayout_10,
"./pages/menu-editor.tsx": PageLayout_11,
"./pages/terms.tsx": PageLayout_12,
"./pages/account.tsx": PageLayout_13,
"./pages/account.wallet.tsx": PageLayout_14,
"./pages/account.payments.tsx": PageLayout_15,
"./pages/account.addresses.tsx": PageLayout_16,
"./pages/privacy-policy.tsx": PageLayout_17,
"./pages/delete-account.tsx": PageLayout_18,
}), fileNameToRoute, makePageRoute })} 
          <Route path="*" element={<NotFound />} />
        </Routes>
      </GlobalContextProviders>
    </BrowserRouter>
  );
}
