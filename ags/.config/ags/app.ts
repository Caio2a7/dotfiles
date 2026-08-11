import app from "ags/gtk4/app"
import {  Work } from "./widget/Work"
import {  Hub } from "./widget/Hub"

app.start({
  css: "/home/caio/.config/ags/style.css",
  requestHandler(request, res) {
    lifeManagerRequest(request, res)
  },
  main() {
    Hub(0)
    Work(0)
  },
})
