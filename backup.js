/* backup.js
 *
 * This file is part of the Night Light Scheduler GNOME Shell extension
 * https://github.com/StorageB/night-light-scheduler
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GLib from "gi://GLib";

import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

let FILE_NAME = "schedule.ini";
let FILE_PATH = GLib.build_filenamev([GLib.get_home_dir(), FILE_NAME]);

export function exportProfile(window, schedule, max_temp, min_temp) {
    const timestamp = new Date().toLocaleString();
    let keyFile = new GLib.KeyFile();

    /* Key file header */

    keyFile.set_comment(
        null,
        null,
        ` Night Light Scheduler \n` +
            ` Exported schedule for the Night Light Scheduler extension \n` +
            ` File generated on ${timestamp} \n` +
            ` \n` +
            ` This file must be named ${FILE_NAME} and be located in the user's home directory to import \n` +
            ` Times must use 24 hour format and be in ascending order beginning with 0:00 \n` +
            ` Temperature (Kelvin) must be between ${min_temp} and ${max_temp} \n` +
            ` \n`,
    );

    /* Export profile */

    for (let entry of schedule) {
        const time =
            entry.hour + ":" + entry.minute.toString().padStart(2, "0");
        keyFile.set_integer("schedule", time, entry.temp);
    }

    /* Save file */

    try {
        keyFile.save_to_file(FILE_PATH);
        const toast = Adw.Toast.new(
            _("Profile exported to: %s").format(FILE_PATH),
        );
        toast.set_timeout(4);
        toast.set_button_label(_("Open"));
        toast.connect("button-clicked", () => {
            // Determine if there is a default text editor available and open the saved file
            let appInfo = Gio.AppInfo.get_default_for_type("text/plain", false);
            if (appInfo) {
                appInfo.launch_uris([`file://${FILE_PATH}`], null);
            } else {
                const noAppDialog = new Gtk.MessageDialog({
                    transient_for: window,
                    modal: true,
                    text: _("Application Not Found"),
                    secondary_text: _(
                        "No default application found to open .ini files.\n\n" +
                            "The %s file can be opened and modified in any text editor. " +
                            "To open the file, it may first be required to manually associate .ini files with the default text editor by doing the following:\n\n" +
                            "1. Open the home directory and locate the %s file\n" +
                            '2. Right-click on the file and select "Open with..."\n' +
                            '3. Choose a default text editor, and select the option "Always use for this file type"',
                    ).format(FILE_NAME, FILE_NAME),
                    buttons: Gtk.ButtonsType.CLOSE,
                });
                noAppDialog.connect("response", () => noAppDialog.destroy());
                noAppDialog.show();
            }
        });
        window.add_toast(toast);
    } catch (e) {
        const toast = Adw.Toast.new(_("Export Error"));
        toast.set_timeout(4);
        toast.set_button_label(_("Details"));
        toast.connect("button-clicked", () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _("Export Error"),
                body: _("Failed to export settings\n\n%s").format(e.message),
            });
            errorDialog.add_response("ok", _("OK"));
            errorDialog.connect("response", () => errorDialog.destroy());
            errorDialog.show();
        });
        window.add_toast(toast);
    }
}

export function importProfile(settings, window, max_temp, min_temp) {
    let keyFile = new GLib.KeyFile();

    /* Check if file exists */

    if (!GLib.file_test(FILE_PATH, GLib.FileTest.EXISTS)) {
        const toast = Adw.Toast.new(_("File not found"));
        toast.set_timeout(4);
        toast.set_button_label(_("Details"));
        toast.connect("button-clicked", () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _("File Not Found"),
                body: _(
                    "The configuration file was not found in the user's home directory.\n\n" +
                        "Verify the following file exists:\n\n%s",
                ).format(FILE_PATH),
            });
            errorDialog.add_response("ok", _("OK"));
            errorDialog.connect("response", () => errorDialog.destroy());
            errorDialog.show();
        });
        window.add_toast(toast);
        return;
    }

    /* Open file */

    try {
        keyFile.load_from_file(FILE_PATH, GLib.KeyFileFlags.NONE);
    } catch (e) {
        const toast = Adw.Toast.new(_("Import Error"));
        toast.set_timeout(4);
        toast.set_button_label(_("Details"));
        toast.connect("button-clicked", () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _("Import Error"),
                body: _("Failed to import configuration\n\n%s").format(
                    e.message,
                ),
            });
            errorDialog.add_response("ok", _("OK"));
            errorDialog.connect("response", () => errorDialog.destroy());
            errorDialog.show();
        });
        window.add_toast(toast);
        return;
    }

    /* Import profile */

    let newSchedule = [];

    try {
        const [keys] = keyFile.get_keys("schedule");

        for (let key of keys) {
            const keyStr = String(key).trim();
            const parts = keyStr.split(":");

            // verify time is in XX:XX format
            if (parts.length !== 2) {
                throw new Error(_("Invalid time format: %s").format(keyStr));
            }

            // verify hours and minutes are numbers
            if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]))
                throw new Error(
                    _(
                        "Invalid time format: %s. Time must be in 24 hour XX:XX format (not AM/PM format)",
                    ).format(key),
                );

            let hour = parseInt(parts[0]);
            let minute = parseInt(parts[1]);

            // verify hours and minutes are in proper range
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
                throw new Error(_("Out of range time: %s").format(key));

            const temp = parseInt(keyFile.get_string("schedule", key), 10);

            // verify temperature is a number
            if (isNaN(temp)) {
                throw new Error(
                    _(
                        "Invalid temperature of %s at %s. Temperature must be an integer without any letters or other characters.",
                    ).format(temp, key),
                );
            }

            // verify temperature is in proper range
            if (temp < min_temp || temp > max_temp)
                throw new Error(
                    _("Out of range temperature of %s at %s").format(temp, key),
                );

            newSchedule.push({ hour, minute, temp });
        }

        // verify the first entry starts at 00:00
        if (
            newSchedule.length === 0 ||
            newSchedule[0].hour !== 0 ||
            newSchedule[0].minute !== 0
        )
            throw new Error(_("Schedule must start at 0:00"));

        // verify time entries are in ascending order
        for (let i = 1; i < newSchedule.length; i++) {
            const prev = newSchedule[i - 1];
            const curr = newSchedule[i];
            const prevMin = prev.hour * 60 + prev.minute;
            const currMin = curr.hour * 60 + curr.minute;
            if (currMin <= prevMin)
                throw new Error(
                    _(
                        "Schedule times must be in ascending order and use 24 hour XX:XX format (not AM/PM format)",
                    ),
                );
        }

        // Convert to GLib.Variant
        const variant = new GLib.Variant(
            "a(uuu)",
            newSchedule.map((e) => [e.hour, e.minute, e.temp]),
        );
        settings.set_value("schedule", variant);
    } catch (e) {
        const toast = Adw.Toast.new(_("Invalid profile format"));
        toast.set_timeout(4);
        toast.set_button_label(_("Details"));
        toast.connect("button-clicked", () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _("Import Error"),
                body: _("Invalid profile\n\n%s").format(e.message),
            });
            errorDialog.add_response("ok", _("OK"));
            errorDialog.connect("response", () => errorDialog.destroy());
            errorDialog.show();
        });

        window.add_toast(toast);
        return;
    }

    const toast = Adw.Toast.new(_("Successfully imported profile"));
    toast.set_timeout(4);
    window.add_toast(toast);
}
