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
 
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';

import { gettext as _, ngettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

let fileName = 'nightlight.ini';
let filePath = GLib.build_filenamev([GLib.get_home_dir(), fileName]);


export function exportProfile(settings, window, schedule) {
    const timestamp = new Date().toLocaleString();
    let keyFile = new GLib.KeyFile();

    /* Header */
    
    keyFile.set_comment(null, null,
        ` Night Light Scheduler \n` +
        ` Exported settings for the Night Light Scheduler extension \n` +
        ` File generated on ${timestamp} \n` +
        ` \n`
        // add key file format info (time format and temp range)
    );

    /* Export Settings */

    for (let entry of schedule) {
        const time =  entry.hour + ":" + entry.minute.toString().padStart(2, "0");
        keyFile.set_integer("schedule", time, entry.temp);
    }

    /* Save file */
    
    try {
        keyFile.save_to_file(filePath);
        console.log(`[Night Light Scheduler] Profile exported to ${filePath}`);
        const toast = Adw.Toast.new(_('Profile exported to: %s').format(filePath));
        toast.set_timeout(4);
        toast.set_button_label(_('Open'));
        toast.connect('button-clicked', () => {
            // Determine if there is a default text editor available and open the saved file
            let appInfo = Gio.AppInfo.get_default_for_type('text/plain', false);
            if (appInfo) {
                appInfo.launch_uris([`file://${filePath}`], null);
            } else {
                const noAppDialog = new Gtk.MessageDialog({
                    transient_for: window,
                    modal: true,
                    text: _('Application Not Found'),
                    secondary_text: _
                        ('No default application found to open .ini files.\n\n' +
                            'The nightlight.ini file can be opened and modified in any text editor. ' +
                            'To open the file, it may first be required to manually associate the .ini file ' +
                            'with the default text editor by doing the following:\n\n' +
                            '1. Open the home directory and locate the nightlight.ini file\n' +
                            '2. Right-click on the file and select "Open with..."\n' +
                            '3. Choose a default text editor, and select the option "Always use for this file type"'
                        ),
                    buttons: Gtk.ButtonsType.CLOSE,
                });
                noAppDialog.connect('response', () => noAppDialog.destroy());
                noAppDialog.show();
            }
        });
        window.add_toast(toast);
    } catch (e) {
        console.log(`[Night Light Scheduler] Failed to export settings\n${e}`);
        const toast = Adw.Toast.new(_('Export Error'));
        toast.set_timeout(4);
        toast.set_button_label(_('Details'));
        toast.connect('button-clicked', () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _('Export Error'),
                body: _('Failed to export settings\n\n%s').format(e),
            });
            errorDialog.add_response('ok', _('OK'));
            errorDialog.connect('response', () => errorDialog.destroy());
            errorDialog.show();
        });
        window.add_toast(toast);
    }
}


export function importProfile(settings, window) {

    let keyFile = new GLib.KeyFile();

    /* Check if file exists */
    
    if (!GLib.file_test(filePath, GLib.FileTest.EXISTS)) {
        const toast = Adw.Toast.new(_('File not found'));
        toast.set_timeout(4);
        toast.set_button_label(_('Details'));
        toast.connect('button-clicked', () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _('File Not Found'),
                body: _(
                    "The %s configuration file was not found in the user's home directory.\n\n" +
                    "Verify the following file exists:\n\n%s"
                ).format(fileName, filePath),
            });
            errorDialog.add_response('ok', _('OK'));
            errorDialog.connect('response', () => errorDialog.destroy());
            errorDialog.show();
        });
        window.add_toast(toast);
        console.log(`[Night Light Scheduler] Failed to import settings. File not found.`);
        return;
    }
    
    /* Open file */
    
    try {
        keyFile.load_from_file(filePath, GLib.KeyFileFlags.NONE);
    } catch (e) {
        console.log('[Night Light Scheduler] Failed to import configuration\n%s'.format(e));
        const toast = Adw.Toast.new(_('Import Error'));
        toast.set_timeout(4);
        toast.set_button_label(_('Details'));
        toast.connect('button-clicked', () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _('Import Error'),
                body: _('Failed to import configuration\n\n%s').format(e),
            });
            errorDialog.add_response('ok', _('OK'));
            errorDialog.connect('response', () => errorDialog.destroy());
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
                console.log(keys);
                console.log(keyStr);
                console.log(parts);
                throw new Error(`Invalid time format: ${keyStr}`);
            }
        
            // verify hours and minutes are numbers
            if (!/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]))
                throw new Error(`Invalid time format: ${key}. Time must be in 24 hour XX:XX format (not AM/PM format)`);
            
            let hour = parseInt(parts[0]);
            let minute = parseInt(parts[1]);
            
            // verify hours and minutes are in proper range
            if (hour < 0 || hour > 24 || minute < 0 || minute > 59)
                throw new Error(`Out of range time: ${key}`);

            // verify temperature is in proper range
            const temp = keyFile.get_integer("schedule", key);
            if (temp < 1600 || temp > 6500)
                throw new Error(`Invalid temperature at ${key}`);

            newSchedule.push({ hour, minute, temp });
        }

        // verify the first entry starts at 00:00
        if (newSchedule.length === 0 || newSchedule[0].hour !== 0 || newSchedule[0].minute !== 0)
            throw new Error("Schedule must start at 0:00");

        // verify time entries are in ascending order
        for (let i = 1; i < newSchedule.length; i++) {
            const prev = newSchedule[i - 1];
            const curr = newSchedule[i];
            const prevMin = prev.hour * 60 + prev.minute;
            const currMin = curr.hour * 60 + curr.minute;
            if (currMin <= prevMin)
                throw new Error("Schedule times must be in ascending order and use 24 hour XX:XX format (not AM/PM format)");
        }

        // Convert to GLib.Variant
        const variant = new GLib.Variant(
            'a(uuu)',
            newSchedule.map(e => [e.hour, e.minute, e.temp])
        );
        settings.set_value('schedule', variant);

    } catch (e) {
        console.log(`[Night Light Scheduler] Import parse error\n${e}`);

        const toast = Adw.Toast.new(_('Invalid profile format'));
        toast.set_timeout(4);
        toast.set_button_label(_('Details'));
        toast.connect('button-clicked', () => {
            let errorDialog = new Adw.MessageDialog({
                transient_for: window,
                modal: true,
                heading: _('Import Error'),
                body: _('Invalid profile\n\n%s').format(e),
            });
            errorDialog.add_response('ok', _('OK'));
            errorDialog.connect('response', () => errorDialog.destroy());
            errorDialog.show();
        });

        window.add_toast(toast);
        return;
    }
    
    
    console.log('[Night Light Scheduler] Configuration imported from %s'.format(filePath));

    const toast = Adw.Toast.new(_('Successfully imported profile'));
    toast.set_timeout(4);
    window.add_toast(toast);

}

/*
export function reset(settings, window) {
    try {
        const schema = settings.settings_schema;
        const keys = schema.list_keys();

        for (const key of keys)
            settings.reset(key);

        const toast = Adw.Toast.new(_('All settings reset to defaults'));
        window.add_toast(toast);

        console.log('[Night Light Scheduler] All settings successfully reset to defaults');
    } catch (e) {
        console.log('[Night Light Scheduler] Failed to reset settings:', e);

        const errorToast = Adw.Toast.new(_('Failed to reset settings'));
        window.add_toast(errorToast);
    }
}
*/
