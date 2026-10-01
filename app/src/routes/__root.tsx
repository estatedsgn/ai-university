import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import meta from "../app-meta.json";
declare const __HF_DESIGN_INSPECTOR__: boolean;
export const Route = createRootRouteWithContext<{queryClient:QueryClient}>()({
 head:()=>({meta:[{charSet:"utf-8"},{name:"viewport",content:"width=device-width, initial-scale=1"},{title:meta.og_title??"AI Университет"},{name:"description",content:meta.og_description??""},{name:"theme-color",content:"#176B5B"},{property:"og:title",content:"AI Университет"},{property:"og:description",content:meta.og_description??""},{property:"og:type",content:"website"},{property:"og:image",content:"https://ai-university.higgsfield.app/cover.png"}],links:[{rel:"stylesheet",href:appCss},{rel:"icon",href:"/favicon.svg"},{rel:"canonical",href:"https://ai-university.higgsfield.app/"}]}),
 shellComponent:RootShell,component:RootComponent,
 notFoundComponent:()=> <div className="empty-page"><h1>Здесь пока нет аудитории</h1><a href="/">Вернуться в кампус</a></div>,
 errorComponent:()=> <div className="empty-page"><h1>Не удалось открыть кампус</h1><p>Попробуйте обновить страницу.</p><a href="/">Вернуться</a></div>
});
function RootShell({children}:{children:ReactNode}){return <html lang="ru"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
function RootComponent(){const {queryClient}=Route.useRouteContext();useEffect(()=>{if(__HF_DESIGN_INSPECTOR__)void import("../module/design-inspector/runtime").then(m=>m.installHiggsfieldDesignInspector()).catch(()=>{});},[]);return <QueryClientProvider client={queryClient}><Outlet/></QueryClientProvider>;}
