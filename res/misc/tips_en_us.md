#@换@ Replace

To replace “foo” with “bar”, just search for “foo” and edit the match you found to “bar”. A notification message and a set of buttons would appear to guide you through the rest.

#@正@ Smart Replace

If you do a regular-expression search and the expression contains brackets, editing the match would initiate a “smart replace” session.

For example, if expression `obj\.([a-z_]+)` matched `obj.foo` and you rewrote it into `obj['foo']`, “replace next” would replace `obj.bar` with `obj['bar']`.

You can generate such expressions from a normal search string using the “@叠@” button.

#@换@ Edit Propagation

To edit multiple lines at the same time, use ALT+SHIFT+↓ or ALT+SHIFT+↑ to select those lines, then edit one line manually. QPad would automatically propagate the changes to the other lines. When you're done, use the replace buttons to confirm the changes.

#@本@ Notebooks

You can use “Tools” - “Notebook...” to open a notebook window for your project. 

You can write build scripts as notebook cells and run them like in an IPython notebook. QPad would look for error locations in the script output and highlight them in your files.

#@签@ Points of Interest

Points of interest, including bookmarks, build errors and unsaved changes, are highlighted in the vertical scroll bar. You can navigate between them using F2 and SHIFT+F2.

#@开@ Browsing Files

You can use “File” - “Recent / project...” to open the “Files” tab. By default, it shows a list of projects. Drag a directory into QPad to add it as a project.

You can type in the search bar to search previously-opened files or files in project directories.

You can also type in a path like `./` to browse files like in a file manager.

#@还@ Maximizing Tabs

You can press ESC to maximize an editor tab.

Press ESC again to restore it.

#@去@ Finding Function / Class

You can use “Search” - “Go to...” to call up a list of functions and classes. You can search for a particular one using its name or abbreviation.

You can also type a line number to go to a certain line. The line number can be an expression like `10000-9000+234`.
