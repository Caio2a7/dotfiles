import app from "ags/gtk4/app"
import GLib from "gi://GLib"
import { Work } from "./widget/Work"
import { Hub } from "./widget/Hub"
import { AppPickerModal } from "./widget/AppPickerModal"

app.start({
  css: "/home/caio/.config/ags/style.css",
  requestHandler(request, res) {
    res("ok")
  },
  main() {
    Hub(0)
    Work(0)
    AppPickerModal(0)
  },
})
