var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var LOADER=require("res/lib/objloader");
require("gui2d/dockbar");
require("res/lib/txtx_editor");
require("res/lib/subwin");

UI.SetFontSharpening(1.5)
var g_icon_font=UI.Font('res/fonts/iconfnt.ttf,!',24);
UI.SetRetardedWindingOrder(UI.core_font_cache['res/fonts/iconfnt.ttf'])

UI.SetUIColorTheme=function(C){
	UI.current_theme_color=C[0];
	UI.default_styles={
		button:{
			transition_dt:0.1,
			round:4,border_width:3,padding:12,
			$:{
				out:{
					border_width:0,
					border_color:0x00ffffff,color:0x00ffffff,
					icon_color:C[0],
					text_color:C[0],
				},
				over:{
					border_color:C[0],color:C[0],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
				down:{
					border_color:C[1],color:C[1],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
			}
		},
		check_button:{
			transition_dt:0.1,
			round:0,border_width:3,padding:12,
			$:{
				out:{
					border_color:0x00ffffff,color:0x00ffffff,
					icon_color:C[0],
					text_color:C[0],
				},
				over:{
					border_color:C[0],color:C[0],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
				down:{
					border_color:C[1],color:C[1],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
				////////////////////
				checked_out:{
					border_color:C[0],color:0x00ffffff,
					icon_color:C[0],
					text_color:C[0],
				},
				checked_over:{
					border_color:C[0],color:C[0],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
				checked_down:{
					border_color:C[1],color:C[1],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
			}
		},
		menu_item:{
			font:UI.Font("res/fonts/opensans.ttf",24),
			transition_dt:0.1,
			round:0,border_width:1,padding:8,
			icon_color:0xff000000,
			text_color:0xff000000,
			$:{
				out:{
					border_color:0x00ffffff,color:0x00ffffff,
				},
				over:{
					border_color:C[0],color:C[0],
					icon_color:0xffffffff,
					text_color:0xffffffff,
				},
			},
		},
		menu:{
			transition_dt:0.1,
			round:4,border_width:2,padding:8,
			layout_spacing:0,
			border_color:C[0],color:0xffffffff,
		},
		combobox:{
			transition_dt:0.1,
			round:8,border_width:2,padding:8,
			layout_spacing:0,
			border_color:C[0],icon_color:C[0],text_color:0xff000000,color:0xffffffff,icon_text_align:'left',
			font:UI.Font("res/fonts/opensans.ttf",24),
			arrow_font:UI.Font("res/fonts/opensans.ttf",24),
		},
		sub_window:{
			transition_dt:0.1,
			round:0,border_width:2,
			padding:4,h_caption:24,
			/////////////////
			layout_direction:"inside",layout_align:'left',layout_valign:'up',
			/////////////////
			font:UI.Font("res/fonts/opensans.ttf",20,100),
			color:0xffffffff,border_color:C[0],border_width:2,
			caption_color:C[0],text_color:0xffdddddd,
			button_style:{
				transition_dt:0.1,
				round:0,border_width:2,padding:8,
				border_width:0,color:0,
				text_color:0xffdddddd,
				font:UI.Font("res/fonts/opensans.ttf",20,100),
				$:{
					out:{
						text_color:0xffdddddd
					},
					over:{
						text_color:0xffffffff,
					},
					down:{
						text_color:0xffffffff,
					},
				}
			},
		},
		tab_label:{
			transition_dt:0.1,
			shadow_color:0xaa000000, shadow_size:8, color:C[0],
			font:UI.Font("res/fonts/opensans.ttf",24), padding:16,
			$:{
				active:{
					text_color:0xffffffff,
				},
				inactive:{
					text_color:0xff444444,
				},
			}
		},
		tabbed_document:{
			transition_dt:0.1,
			h_caption:32, h_bar:4, color:0xffbbbbbb,
		},
		box_document:{
			border_color:(0xcc000000&C[0]),border_width:2,
			color:(0x44000000&C[0]),
		},
		txtx_editor:{
			border_color:0xff000000,border_width:2,
			color:0xffffffff,
		},
		slider:{
			transition_dt:0.1,
			bgcolor:[{x:0,y:0,color:0xffbbbbbb},{x:0,y:1,color:0xffdddddd}],
			//border_width:2, border_color:0xff444444,
			round:8,
			color:C[0],
			padding:0,
			//label_text:'▲',
			//label_raise:0.4,
			//label_font:UI.Font("res/fonts/opensans.ttf",32),
			//label_color:C[0],
			middle_bar:{
				w:8,h:8,
				round:2,
				color:0xffffffff, border_width:2, border_color:0xff444444,
			},
		},
		edit_box:{
			transition_dt:0.1,
			round:4,padding:8,
			color:0xffffffff,
			border_width:0,
			border_color:0xffffffff,
			font:UI.Font("res/fonts/opensans.ttf",24),
			text_color:0xff000000,
			$:{
				blur:{
					border_width:0,
					border_color:0xffffffff,
				},
				focus:{
					border_width:2,
					border_color:C[0],
				},
			},
		},
		color_picker:{
			w_text:16,w_slider:128,w_edit:54,
			h_slider:12,
			h_edit:32,
			h_space:24,
			padding:8,
			border_width:1.5,
			border_color:0xff444444,
			text_color:0xff000000,
			font:UI.Font("res/fonts/opensans.ttf",24),
		},
	};
};
UI.SetUIColorTheme([0xffcc7733,0xffaa5522])

//var g_doc=UI.CreateTxtxDocument({w:1200,h:1600});
//var g_layout={
//	direction:'tab',
//	items:[
//		{object_type:W.TxtxView,
//			id:"$test",
//			anchor_align:"fill",anchor_valign:"fill",
//			doc:g_doc,
//			scale:1,
//			///////////////
//			bgcolor:0xffffffff,
//		},
//	],
//};
//{
//	title:"Document 0",
//	body:function(){
//		//todo
//	},
//},{
//	title:"Document 1",
//	body:function(){
//		//todo
//	},
//},

var g_all_document_windows=[];
UI.NewTab=function(tab){
	g_all_document_windows.push(tab)
	return tab;
}

UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		UI.Begin(W.Window('app',{
				title:'Mini-Office',w:1280,h:720,bgcolor:0xfff0f0f0,
				designated_screen_size:1080,flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){UI.DestroyWindow(UI.top.app)}});
			}
			var w_bar=2;
			var w_property_bar=320;
			var property_windows=[]
			W.TabbedDocument("document_area",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':UI.top.app.w-w_property_bar,
				items:g_all_document_windows,
			})
			if(UI.top.app.document_area.active_tab){
				property_windows=(UI.top.app.document_area.active_tab.property_windows||property_windows);
			}
			//////////////////////////
			//todo: hiding
			if(w_property_bar>0){
				W.Group("property_bar",{
					'anchor':'parent','anchor_align':"right",'anchor_valign':"fill",
					'x':0,'y':0,'w':w_property_bar,
					item_template:{'object_type':W.SubWindow},items:property_windows,
					///////////
					'layout_direction':'down','layout_spacing':0,'layout_align':'fill','layout_valign':'up',
				});
				W.RoundRect("",{
					'anchor':UI.top.app.property_bar,'anchor_align':"left",'anchor_valign':"fill",
					'x':0,'y':0,'w':w_bar,
					'color':UI.default_styles.tab_label.color,
				})
			}
			//////////////////////////
			W.Hotkey("",{key:"CTRL+N",action:function(){
				g_all_document_windows.push(UI.NewTxtxDocument())
				UI.Refresh()
			}});
			W.Hotkey("",{key:"CTRL+S",action:function(){
				var doc_area=UI.top.app.document_area;
				var active_document=doc_area[doc_area.active_tab.id];
				if(active_document&&active_document.body&&active_document.body.Save){
					active_document.body.Save.call(active_document.body)
				}
			}});
			W.Hotkey("",{key:"CTRL+O",action:function(){
				var fn=IO.DoFileDialog(["Txtx documents (*.txtx)","*.txtx","All File","*.*"]);
				if(!fn){return;}
				LOADER.LoadFile(fn);
				UI.Refresh()
			}});
		UI.End();
	UI.End();
};

UI.Run()
