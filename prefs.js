/* prefs.js
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
 
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import GLib from "gi://GLib";
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { createScheduleGraph } from './graph.js';
import { exportProfile } from './backup.js';
import { importProfile } from './backup.js';

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.set_default_size(630, 760);
        window._settings = this.getSettings();
        
        const provider = new Gtk.CssProvider();
        provider.load_from_path(
            this.dir.get_child('stylesheet.css').get_path()
        );
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
        
        const rows = [];
        const timeIncrement = 15;
        
        const page = new Adw.PreferencesPage({
            title: _('Profile'),
            icon_name: 'night-light-symbolic',
        });
        window.add(page);
        
        
        /* Check if Night Light is on, show banner if off */
        
        const colorSettings = new Gio.Settings({
            schema: "org.gnome.settings-daemon.plugins.color",
        });

        if (!colorSettings.get_boolean("night-light-enabled")) {
        
            const bannerGroup = new Adw.PreferencesGroup();
            page.add(bannerGroup);
        
            const bannerRow = new Adw.PreferencesRow({
                activatable: false,
            });
        
            const banner = new Adw.Banner({
                title: "Night Light setting is currently off. Turn on to enable scheduling.",
                button_label: "Dismiss",
                revealed: true,
            });
            bannerRow.set_child(banner);
            bannerGroup.add(bannerRow);
            
            banner.connect("button-clicked", () => {
                page.remove(bannerGroup);
            });
        }
        
        
        /* Get system clock format (12h or 24h) */
        
        const clockSettings = new Gio.Settings({
            schema: "org.gnome.desktop.interface",
        });
        let clockFormat = clockSettings.get_string("clock-format");
        
        clockSettings.connect("changed::clock-format", () => {
            clockFormat = clockSettings.get_string("clock-format");
            drawingArea.setClockFormat(clockFormat);
            buildScheduleUI();
        });
        
        
        /* Add chart */
        
        const chartGroup = new Adw.PreferencesGroup();
        page.add(chartGroup);
        
        const entryGroup = new Adw.PreferencesGroup();
        page.add(entryGroup);  

        const rawSchedule = window._settings.get_value('schedule').deep_unpack();
        const schedule = rawSchedule.map(([hour, minute, temp]) => ({ hour, minute, temp }));

        const drawingArea = createScheduleGraph(schedule, clockFormat);
        const chartRow = new Adw.PreferencesRow({
            activatable: false,
        });
        const chartBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: true,
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
        });
        chartBox.append(drawingArea);
        chartRow.set_child(chartBox);
        chartGroup.add(chartRow);
        
        
        /* Build UI */
        
        buildScheduleUI();
        
        
        /* Functions */
        
        function saveSchedule() {
            const variant = new GLib.Variant(
                'a(uuu)',
                schedule.map(e => [e.hour, e.minute, e.temp])
            );
            window._settings.set_value('schedule', variant);
        }
        
        function formatTime24h(minutes) {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        
        function formatTimeAMPM(minutes) {
        
            let hour = Math.floor(minutes / 60);
            const minute = minutes % 60;
        
            const ampm = hour >= 12 ? "PM" : "AM";
        
            hour = hour % 12;
            if (hour === 0) hour = 12;
        
            return `${hour}:${String(minute).padStart(2,'0')} ${ampm}`;
        }
        
        function buildScheduleUI() {
        
            for (let row of rows) entryGroup.remove(row);
            
            rows.length = 0;
            
            for (let entry of schedule) {
            
                const totalMinutes = entry.hour * 60 + entry.minute;
                const row = new Adw.ActionRow({});
                
                const plusTimeBtn = createButton("go-next-symbolic");
                row.add_prefix(plusTimeBtn);
                
                const timeLabel = new Gtk.Label({
                    label: clockFormat === "24h" ? formatTime24h(totalMinutes) : formatTimeAMPM(totalMinutes),
                    valign: Gtk.Align.CENTER,
                });
                timeLabel.width_chars = (clockFormat === "24h" ? 5 : 8);
                row.add_prefix(timeLabel);

                const minusTimeBtn = createButton("go-previous-symbolic");
                row.add_prefix(minusTimeBtn);
                                
                const tempLabel = new Gtk.Label({
                    label: `${entry.temp} K`,
                    xalign: 1,
                    width_chars: 5,
                });
                tempLabel.add_css_class("dim-label");
                row.add_suffix(tempLabel);
                
                const adjustment = new Gtk.Adjustment({
                    lower: 1700,
                    upper: 6500,
                    step_increment: 50,
                    page_increment: 100,
                    value: entry.temp,
                });
                const scale = new Gtk.Scale({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    adjustment: adjustment,
                    digits: 0,
                    width_request: 200,
                });
                scale.valign = Gtk.Align.CENTER;
                scale.add_css_class("compact");
                row.add_suffix(scale);
                
                const deleteButton = createButton("list-remove-symbolic");
                row.add_suffix(deleteButton);

                const insertButton = createButton("list-add-symbolic");
                row.add_suffix(insertButton);

                if (entry.hour === 0 && entry.minute === 0) {
                    deleteButton.set_sensitive(false); 
                    minusTimeBtn.set_sensitive(false);
                    plusTimeBtn.set_sensitive(false);
                } 
                
                function createButton(icon) {
                    return new Gtk.Button({
                        icon_name: icon,
                        has_frame: false,
                        valign: Gtk.Align.CENTER,
                    });
                }
                
                function adjustTime(deltaMinutes) {
                    
                    const index = schedule.indexOf(entry);
                    if (index === -1) return;
                
                    let minutes = entry.hour * 60 + entry.minute;
                    
                    if (deltaMinutes > 0) {
                        minutes = Math.floor(minutes / timeIncrement) * timeIncrement;
                        minutes += timeIncrement;
                    } else {
                        minutes = Math.ceil(minutes / timeIncrement) * timeIncrement;
                        minutes -= timeIncrement;
                    }
                
                    let minMinutes = 0;
                    let maxMinutes = 1440;
                
                    if (index > 0) {
                        const prev = schedule[index - 1];
                        minMinutes = prev.hour * 60 + prev.minute;
                    }
                
                    if (index < schedule.length - 1) {
                        const next = schedule[index + 1];
                        maxMinutes = next.hour * 60 + next.minute;
                    }
                
                    if (minutes <= minMinutes) return;
                    if (minutes >= maxMinutes) return;
                
                    entry.hour = Math.floor(minutes / 60);
                    entry.minute = minutes % 60;
                
                    timeLabel.set_label(clockFormat === "24h" ? formatTime24h(minutes) : formatTimeAMPM(minutes),);
                
                    saveSchedule();
                    drawingArea.setSchedule(schedule);
                }

                let repeatId = 0;
                
                function startRepeat(delta) {
                    if (repeatId !== 0) return;
                
                    adjustTime(delta);
                
                    repeatId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 120, () => {
                        adjustTime(delta);
                        return GLib.SOURCE_CONTINUE;
                    });
                }
                
                function stopRepeat() {
                    if (repeatId !== 0) {
                        GLib.source_remove(repeatId);
                        repeatId = 0;
                    }
                }
                
                const plusPress = new Gtk.GestureClick();
                plusPress.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
                
                plusPress.connect("pressed", () => {
                    startRepeat(timeIncrement);
                });
                plusPress.connect("released", stopRepeat);
                plusPress.connect("cancel", stopRepeat);
                
                plusTimeBtn.add_controller(plusPress);
                
                const minusPress = new Gtk.GestureClick();
                minusPress.set_propagation_phase(Gtk.PropagationPhase.CAPTURE);
                
                minusPress.connect("pressed", () => {
                    startRepeat(-timeIncrement);
                });
                minusPress.connect("released", stopRepeat);
                minusPress.connect("cancel", stopRepeat);
                
                minusTimeBtn.add_controller(minusPress);
                
                
                scale.connect('value-changed', () => {
                    
                    let temp = Math.round(scale.get_value() / 50) * 50;
                
                    if (temp !== scale.get_value()) scale.set_value(temp);
                
                    entry.temp = temp;
                    tempLabel.set_label(`${temp} K`);
                
                    saveSchedule();
                    drawingArea.setSchedule(schedule);
                });
            
                insertButton.connect('clicked', () => {
                
                    const index = schedule.indexOf(entry);
                    if (index === -1) return;
                
                    const currentMinutes = entry.hour * 60 + entry.minute;
                
                    let nextMinutes = 1440;
                
                    if (index < schedule.length - 1) {
                        const next = schedule[index + 1];
                        nextMinutes = next.hour * 60 + next.minute;
                    }
                
                    let newMinutes = Math.floor((currentMinutes + nextMinutes) / 2);
                    newMinutes = Math.round(newMinutes / timeIncrement) * timeIncrement;
                
                    if (nextMinutes - currentMinutes <= timeIncrement)
                        return; // ADD ERROR MESSAGE TOAST HERE (or grey out button) - no room between points to add new
                    
                    if (newMinutes <= currentMinutes) newMinutes = currentMinutes + timeIncrement;
                    if (newMinutes >= nextMinutes) newMinutes = nextMinutes - timeIncrement;
                
                    const newEntry = {
                        hour: Math.floor(newMinutes / 60),
                        minute: newMinutes % 60,
                        temp: entry.temp,
                    };
                
                    schedule.splice(index + 1, 0, newEntry);
                    
                    saveSchedule();
                    drawingArea.setSchedule(schedule);
                    buildScheduleUI();
                });
                
                deleteButton.connect('clicked', () => {
            
                    const index = schedule.indexOf(entry);
                    if (index === -1) return;
            
                    schedule.splice(index, 1);
            
                    entryGroup.remove(row);
            
                    const rowIndex = rows.indexOf(row);
                    if (rowIndex !== -1) rows.splice(rowIndex, 1);
            
                    saveSchedule();
                    drawingArea.setSchedule(schedule);
                });
            
            
                rows.push(row);
                entryGroup.add(row);
                
            } // end of for loop to create entries
            
            
            drawingArea.setHoverCallback((index) => {
                rows.forEach(row =>
                    row.remove_css_class("row-hover-highlight")
                );
                if (index >= 0 && rows[index]) rows[index].add_css_class("row-hover-highlight");
            });
            
        } // end buildScheduleUI function
        
        
        /* --- Configuration Page --- */
        
        const configPage = new Adw.PreferencesPage({
            title: _('Configuration'),
            icon_name: 'applications-system-symbolic',
        });
        window.add(configPage);
        
        const backupGroup = new Adw.PreferencesGroup({
            title: _('Backup and Restore'),
        });
        
        const exportRow = new Adw.ActionRow({
            title: _('Export Profile'),
            subtitle: _('Click to export current profile'),
            activatable: true,
	    });
	    exportRow.add_prefix(new Gtk.Image({ icon_name: 'x-office-document-symbolic' }));
        
        exportRow.connect('activated', () => {
            exportProfile(window._settings, window, schedule);
        });
        
        const importRow = new Adw.ActionRow({
            title: _('Import Profile'),
            subtitle: _('Click to import a profile'),
            activatable: true,
        });
        importRow.add_prefix(new Gtk.Image({ icon_name: 'x-office-document-symbolic' }));
        
        importRow.connect('activated', () => {
            importProfile(window._settings, window);
            schedule.length = 0;
            const rawSchedule = window._settings.get_value('schedule').deep_unpack();
            for (let [hour, minute, temp] of rawSchedule) {
                schedule.push({ hour, minute, temp });
            }
        
            drawingArea.setSchedule(schedule);
            buildScheduleUI();
        });
        
        configPage.add(backupGroup);
        backupGroup.add(exportRow);
        backupGroup.add(importRow);       
    
    } // end of fillPreferencesWindow
    
} // end of Prefs class