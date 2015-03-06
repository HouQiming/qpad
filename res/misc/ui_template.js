UI.Theme_Minimalistic([0xffcc7733])
UI.Application=function(id,attrs){
	UI.Begin(UI.Keep(id,attrs));
	var wnd=UI.Begin(W.Window('app',{
		title:'New App',w:480,h:640,bgcolor:0xffffffff,
		designated_screen_size:1080,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
		is_main_window:1}));
	/*insert here*/
	UI.End();
	UI.End();
};
UI.Run()
