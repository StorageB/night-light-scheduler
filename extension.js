/* extension.js
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

import GLib from "gi://GLib";
import Gio from "gi://Gio";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

export default class NightLightScheduler extends Extension {
    enable() {
        this._extensionSettings = this.getSettings();
        this._colorSettings = new Gio.Settings({
            schema: "org.gnome.settings-daemon.plugins.color",
        });

        this._scheduleChangedId = this._extensionSettings.connect(
            "changed::schedule",
            () => {
                this._scheduleNext();
            },
        );

        this._scheduleNext();
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._scheduleChangedId) {
            this._extensionSettings.disconnect(this._scheduleChangedId);
            this._scheduleChangedId = null;
        }

        this._extensionSettings = null;
        this._colorSettings = null;
    }

    _scheduleNext() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        const rawSchedule = this._extensionSettings
            .get_value("schedule")
            .deep_unpack();
        const schedule = rawSchedule.map(([hour, minute, temp]) => ({
            hour,
            minute,
            temp,
        }));

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentSeconds = now.getSeconds();

        let selectedTemp = schedule[0].temp;
        let nextMinutes = null;

        for (let entry of schedule) {
            const entryMinutes = entry.hour * 60 + entry.minute;

            if (entryMinutes <= currentMinutes) selectedTemp = entry.temp;
            else if (nextMinutes === null) nextMinutes = entryMinutes;
        }

        if (nextMinutes === null)
            nextMinutes = schedule[0].hour * 60 + schedule[0].minute + 1440;

        const secondsUntilNext = Math.max(
            1,
            (nextMinutes - currentMinutes) * 60 - currentSeconds,
        );

        const currentTemp = this._colorSettings.get_uint(
            "night-light-temperature",
        );

        //console.log(`[Night Light Scheduler] current time: ${currentMinutes} minutes | current temp: ${currentTemp}K | selected temp: ${selectedTemp}K | next change in: ${secondsUntilNext}s`);

        if (currentTemp !== selectedTemp) {
            this._colorSettings.set_uint(
                "night-light-temperature",
                selectedTemp,
            );
            //console.log(`[Night Light Scheduler] Temperature set to ${selectedTemp}`);
        }

        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            secondsUntilNext,
            () => {
                this._scheduleNext();
                return GLib.SOURCE_REMOVE;
            },
        );
    }
}
