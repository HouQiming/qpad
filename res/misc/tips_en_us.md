# 换 Replace

To replace “foo” with “bar”, just search for “foo” and edit the match you found to “bar”. A notification message and a set of buttons would appear to guide you through the rest.

# 正 Smart Replace

If you do a regular-expression search and the expression contains brackets, editing the match would initiate a “smart replace” session.

For example, if expression `obj\.([a-z_]+)` matched `obj.foo` and you rewrote it into `obj['foo']`, “replace next” would replace `obj.bar` with `obj['bar']`.

# 本 Notebooks

You can use “File” - “Open notebook...” to open a notebook window for your project. 

You can write build scripts as notebook cells and run them like in an IPython notebook. QPad would look for error locations in the script output and highlight them in your files.

# 签 Points of Interest

Points of interest, including bookmarks, build errors and unsaved changes, are highlighted in the vertical scroll bar. You can navigate between them using F2 and SHIFT+F2.

# 开 Browsing Files

You can use “File” - “Recent / project...” to open the “Files” tab. By default, it shows a list of projects. Drag a directory into QPad to add it as a project.

You can type in the search bar to search previously-opened files or files in project directories.

You can also type in a path like `./` to browse files like in a file manager.

# 还 Maximizing Tabs

You can press ESC to maximize an editor tab.

Press ESC again to restore it.
