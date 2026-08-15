import app from "ags/gtk4/app"
import {  Work } from "./widget/Work"
import {  Hub } from "./widget/Hub"
import {  TodoCards } from "./widget/TodoCards"

app.start({
  css: "/home/caio/.config/ags/style.css",
  main() {
    Hub(0)
    Work(0)
    TodoCards(0)
  },
})
