import { onRequest as ____path___js_onRequest } from "C:\\projects\\api rerouter\\claude-max\\functions\\[[path]].js"

export const routes = [
    {
      routePath: "/:path*",
      mountPath: "/",
      method: "",
      middlewares: [],
      modules: [____path___js_onRequest],
    },
  ]