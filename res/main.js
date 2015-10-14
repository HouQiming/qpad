var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");
require("res/lib/txtx_editor");
require("res/lib/code_editor");
require("res/lib/subwin");
require("res/lib/demo_doc");

UI.ChooseScalingFactor({designated_screen_size:1080})
UI.SetFontSharpening(1);
(function(){
	UI.pixels_per_unit_base=UI.pixels_per_unit
	UI.pixels_per_unit*=(UI.m_ui_metadata.zoom||1)
	UI.ResetRenderer(UI.pixels_per_unit);
})();
//UI.SetFontSharpening(0)
UI.fallback_font_names=["res/fonts/dsanscn.ttc"]
UI.icon_font_name='res/fonts/iconfnt.ttf,!'
UI.Theme_CustomWidget=function(C){
	var C_dark=UI.lerp_rgba(C[0],0xff000000,0.15)
	var C_sel=UI.lerp_rgba(C[0],0xffffffff,0.75)
	var custom_styles={
		tooltip:{
			font:UI.Font(UI.font_name,24,-100),
			padding:8,
			spacing:8,
			color:0xffffffff,
			round:8,
			border_color:0xff000000,
			border_width:1,
			text_color:0xff000000,
			shadow_size:6,
			shadow_color:0xaa000000,
			triangle_font:UI.Font(UI.font_name,32,0),
			triangle_font2:UI.Font(UI.font_name,32,250),
		},
		sub_window:{
			transition_dt:0.1,
			round:0,border_width:2,
			padding:4,h_caption:24,
			/////////////////
			layout_direction:"inside",layout_align:'left',layout_valign:'up',
			/////////////////
			font:UI.Font(UI.font_name,20,100),
			color:0xffffffff,border_color:C[0],border_width:2,
			caption_color:C[0],text_color:0xffdddddd,
			button_style:{
				transition_dt:0.1,
				round:0,border_width:2,padding:8,
				border_width:0,color:0,
				text_color:0xffdddddd,
				font:UI.Font(UI.font_name,20,100),
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
			shadow_size:8,
			font:UI.Font(UI.font_name,24,-100), padding:16,
			$:{
				active:{
					text_color:0xffffffff,
					color:C[0],
					shadow_color:0xaa000000,
				},
				inactive:{
					text_color:0xff000000,
					color:C[0]&0x00f0f0f0,
					shadow_color:0x00000000, 
				},
			}
		},
		tabbed_document:{
			transition_dt:0.1,
			h_caption:32, h_bar:4, color:0xffbbbbbb, border_color:C[0],
			w_menu_button:26,
			h_menu_button:26,
			padding:4,
			menu_bar_color:[{x:0,y:0,color:0xffffffff},{x:0,y:1,color:0xffe8e8e8}],
			menu_bar_border_width:1,
			menu_bar_border_color:0xffaaaaaa,
			menu_button_style:{
				transition_dt:0.25,
				round:0,padding:0,
				color:0,
				$:{
					out:{
						text_color:0xffaaaaaa,
					},
					over:{
						text_color:C[0],
					},
					down:{
						text_color:UI.lerp_rgba(C[0],0xff000000,0.2),
					},
					checked_out:{
						text_color:C[0],
					},
					checked_over:{
						text_color:C[0],
					},
					checked_down:{
						text_color:UI.lerp_rgba(C[0],0xff000000,0.2),
					},
				}
			},
		},
		save_dialog:{
			transition_dt:0.1,
			color:0x00d0d0d0,
			$:{
				active:{
					color:0x7fffffff,
				},
				inactive:{
					color:0x00ffffff,
				},
			},
			///////////
			space_dlg_rect:56,
			round_dlg_rect:32,
			color_dlg_rect:0xf0ffffff,
			font_text:UI.Font(UI.font_name,40,-100),
			text_color:0xff000000,
			font_buttons:UI.Font(UI.font_name,24,-100),
			space_middle:40,
			space_button:96,
			h_button:32,
			good_button_style:{
				transition_dt:0.1,
				round:32,border_width:0,padding:24,
				$:{
					out:{
						color:[{x:0,y:0,color:UI.lerp_rgba(C[0],0xffffffff,0.2)},{x:0,y:1,color:UI.lerp_rgba(C[0],0xff000000,0.1)}],
						icon_color:0xfff0f0f0,
						text_color:0xfff0f0f0,
					},
					over:{
						color:[{x:0,y:0,color:UI.lerp_rgba(C[0],0xffffffff,0.4)},{x:0,y:1,color:UI.lerp_rgba(C[0],0xffffffff,0.1)}],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					down:{
						color:[{x:0,y:0,color:UI.lerp_rgba(C[0],0xffffffff,0.1)},{x:0,y:1,color:UI.lerp_rgba(C[0],0xff000000,0.2)}],
						icon_color:0xfff0f0f0,
						text_color:0xfff0f0f0,
					},
				}
			},
			bad_button_style:{
				transition_dt:0.1,
				round:32,border_width:0,padding:24,
				$:{
					out:{
						color:[{x:0,y:0,color:0xff999999},{x:0,y:1,color:0xff666666}],
						icon_color:0xfff0f0f0,
						text_color:0xfff0f0f0,
					},
					over:{
						color:[{x:0,y:0,color:0xffaaaaaa},{x:0,y:1,color:0xff7f7f7f}],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					down:{
						color:[{x:0,y:0,color:0xff888888},{x:0,y:1,color:0xff555555}],
						icon_color:0xfff0f0f0,
						text_color:0xfff0f0f0,
					},
				}
			},
		},
		box_document:{
			border_color:(0xccffffff&C[0]),border_width:2,w_snapping_line:2,
			color:(0x44ffffff&C[0]),
		},
		txtx_editor:{
			border_color:0xff000000,border_width:2,
			color:0xffffffff,
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
			font:UI.Font(UI.font_name,24),
		},
		demo_document:{
			thumbnail_style:{
				border_color:0xff000000,
				border_width:1.5,
				text_color:0xff000000,
				sel_border_color:C[0],
				sel_border_width:3,
				sel_text_color:C[0],
				font:UI.Font(UI.font_name,24),
				text_padding:4,
			},
			new_page_button_style:{
				transition_dt:0.1,
				round:0,border_width:3,padding:0,color:0,
				font:UI.Font(UI.font_name,72,-50),
				$:{
					out:{
						border_color:0x80000000,
						icon_color:0x80000000,
						text_color:0x80000000,
					},
					over:{
						border_color:0xaa000000,
						icon_color:0xaa000000,
						text_color:0xaa000000,
					},
					down:{
						border_color:0xaa000000,
						icon_color:0xaa000000,
						text_color:0xaa000000,
					},
				},
			},
		},
		style_item:{
			border_color:0,border_width:0,
			color:0x00000000,
			padding:4,
			$:{
				focus:{
					color:C_sel,
				},
				blur:{
					color:0x00000000,
				}
			}
		},
		code_editor:{
			editor_style:{
				//wrap_width:1536,
				//font:UI.Font("res/fonts/inconsolata.ttf",36),
				//font_emboldened:UI.Font("res/fonts/inconsolata.ttf",36,200),
				//tex_font:UI.Font("res/fonts/cmunrm.ttf",36),
				//tex_font_emboldened:UI.Font("res/fonts/cmunrm.ttf",36,200),
				//font_tilde:UI.Font(UI.icon_font_name,36,100),
				font:UI.Font("res/fonts/inconsolata.ttf",28),
				font_emboldened:UI.Font("res/fonts/inconsolata.ttf",28,200),
				tex_font:UI.Font("res/fonts/cmunrm.ttf",28),
				tex_font_emboldened:UI.Font("res/fonts/cmunrm.ttf",28,200),
				font_tilde:UI.Font(UI.icon_font_name,28,100),
				//font:UI.Font("res/fonts/inconsolata.ttf",32),
				//font_emboldened:UI.Font("res/fonts/inconsolata.ttf",32,200),
				//tex_font:UI.Font("res/fonts/cmunrm.ttf",32),
				//tex_font_emboldened:UI.Font("res/fonts/cmunrm.ttf",32,200),
				//font_tilde:UI.Font(UI.icon_font_name,32,100),
				color:0xff000000,
				color2:0xff000000,
				color_normal:0xff000000,
				color_overlay:0xff7f7f7f,
				color_string:0xff1c1aa3,
				color_number:0xff1c1aa3,
				color_comment:0xff2ca033,
				color_keyword:0xffb4771f,
				color_type:0xffbc470f,
				color_symbol:0xff7f7f7f,
				color_symbol2:0xff7f7f7f,
				color_meta:0xff9a3d6a,
				/////////////
				color_key_decl_func:0xff845717,//0xff5a3b0f,
				color_key_decl_class:0xffbc470f,
				color_key_decl_macro:0xff9a3d6a,
				/////////////
				//virtual hyphen for tex-like files, should be even less obvious than normal symbols
				color_hyphen:0xffaaaaaa,
				color_tilde_spell_error:0xff1c1aa3,
				color_tilde_compiler_error:0xff1c1aa3,
				color_tilde_compiler_warning:0xff2ca033,
				/////////////
				color_completing_bracket:0x80999999,
				color_auto_edit_range_highlight:0x4099ffff,
				color_strikeout:0x80444444,
				/////////////
				bgcolor_ellipsis:[{x:0,y:0,color:0xffffffff},{x:1,y:1,color:C_sel}],
				w_ellipsis:32,
				padding_ellipsis:2,
				h_ellipsis:20,
				/////////////
				bgcolor_selection:C[0]&0x3fffffff,
				tab_width:4,
				scroll_transition_dt:0.075,
			},
			bgcolor:0xffe8e8e8,
			padding:6,
			separator_color:0xff999999,
			///////
			show_top_hint:1,
			top_hint_shadow_color:0x7f000000,
			top_hint_shadow_size:8,
			top_hint_border_width:2,
			top_hint_border_color:0xffaaaaaa,
			top_hint_max_lines:5,
			top_hint_max_levels:20,
			x_scroll_shadow_color:0x7f000000,
			x_scroll_shadow_size:8,
			///////
			show_line_numbers:1,
			line_number_font:UI.Font("res/fonts/opensans.ttf",14,-50),
			line_number_bgcolor:0xffd0d0d0,
			line_number_color:0xff7f7f7f,
			line_number_color_focus:0xff000000,
			color_cur_line_highlight:0x55ffffff,
			///////
			bookmark_font:UI.Font("res/fonts/opensans.ttf",12,200),
			bookmark_color:[{x:0,y:0,color:0xffffffff},{x:1,y:1,color:C_sel}],
			bookmark_text_color:C[0],
			//bookmark_shadow:0xff000000,
			bookmark_border_color:C[0],
			bookmark_scroll_bar_marker_size:2,
			///////
			//color_diff_tag:[{x:0,y:0,color:0xff2ca033&0xffffff},{x:1,y:0,color:0xff2ca033}],
			color_diff_tag:[{x:0,y:0,color:C&0xffffff},{x:1,y:0,color:C}],
			///////
			show_minimap:(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="android"||UI.Platform.ARCH=="ios")?0:1,
			minimap_font_height:6,
			minimap_page_shadow:0x1f000000,
			minimap_page_border_width:2,
			minimap_page_border_color:0xffaaaaaa,
			w_minimap:128,
			///////
			h_find_bar:32,
			find_bar_bgcolor:0xffffffff,
			find_bar_color:0xffe8e8e8,
			find_bar_round:8,
			find_bar_padding:4,
			find_bar_hint_color:0xff7f7f7f,
			find_bar_shadow_color:0x7f000000,
			find_bar_shadow_size:8,
			find_bar_hint_font:UI.Font("res/fonts/opensans.ttf",20,-50),
			find_bar_button_size:28,
			find_bar_editor_style:{
				font:UI.Font("res/fonts/inconsolata.ttf",20),
				tex_font:UI.Font("res/fonts/cmunrm.ttf",20),
				font_emboldened:UI.Font("res/fonts/inconsolata.ttf",20,200),
				tex_font_emboldened:UI.Font("res/fonts/cmunrm.ttf",20,200),
				//font_tilde:UI.Font(UI.icon_font_name,28,100),
				font_tilde:UI.Font(UI.icon_font_name,26,100),
				color:0xff000000,
				color_overlay:0xff000000,
				color_string:0xff1c1aa3,
				color_number:0xff1c1aa3,
				color_comment:0xff2ca033,
				color_keyword:0xffb4771f,
				color_type:0xffbc470f,
				color_symbol:0xff7f7f7f,
				bgcolor_selection:C[0]&0x3fffffff,
				tab_width:4,
			},
			find_item_scale:0.8,
			find_item_expand_current:4,//in lines
			find_item_separation:6,
			find_item_border_width:0,
			find_item_border_color:0xff444444,
			find_item_shadow_color:0x7f000000,
			find_item_shadow_size:4,
			find_mode_bgcolor:0xffc0c0c0,
			find_item_highlight_color:0x55007fff,
			find_message_font:UI.Font("res/fonts/opensans.ttf",32,-50),
			find_message_color:0xff444444,
			///////
			show_auto_completion:1,
			accands_font:UI.Font("res/fonts/opensans.ttf",22,-50),
			accands_id_font:UI.Font("res/fonts/opensans.ttf",12,200),
			accands_padding:24,
			accands_left_padding:14,
			accands_sel_padding:2,
			accands_shadow_color:0x7f000000,
			accands_shadow_size:8,
			accands_bgcolor:0xffffffff,
			accands_round:4,
			accands_border_width:0,
			accands_border_color:0xff000000,
			accands_text_color:0xff000000,
			accands_text_sel_color:0xffffffff,
			accands_sel_bgcolor:C[0],
			accands_n_shown:5,
			//w_accands:512,
			h_accands:32,
			///////
			w_scroll_bar:20,
			scroll_bar_style:{
				transition_dt:0.1,
				//bgcolor:0xffd0d0d0,
				round:0,
				padding:0,
				szbar_min:32,
				middle_bar:{
					w:12,h:12,
					round:6,
					color:[{x:0,y:0,color:0xff999999},{x:1,y:1,color:0xff666666}],
					border_color:0,
				},
				$:{
					out:{},
					over:{},
				},
			},
			///////
			w_notification:340,
			dx_shake_notification:-300,
			///////
			sxs_shadow_size:6,
			sxs_shadow_color:0xaa000000,
			///////
			status_bar_bgcolor:[{x:0,y:0,color:0xffffffff},{x:0,y:1,color:0xffd0d0d0}],
			status_bar_font:UI.Font("res/fonts/opensans.ttf",20,-50),
			status_bar_padding:4,
			status_bar_text_color:0xff444444,
		},
		code_editor_notification:{
			transition_dt:0.1,
			padding:6,
			w_icon:24,
			w_text:300,
			shadow_size:8,
			shadow_color:0xff000000,
			color:0xffffffff,
			border_color:0xff000000,
			border_width:0,
			round:4,
			text_color:0xff444444,
			progress_color:C_sel,
			font:UI.Font(UI.font_name,20,-100),
			icon_color:0xff000000,
			icon_font:UI.Font('res/fonts/iconfnt.ttf,!',20),
			icon:'告',
			//////////
			k_shake:400,
			damping_shake:8,
			x_min_shake:0.5,
			dx_min_shake:0.5,
		},
		sxs_build_output:{
			border_width:0,
			color:0xffffffff,
			editor_style:{
				font:UI.Font("res/fonts/inconsolata.ttf",16,-100),
				font_emboldened:UI.Font("res/fonts/inconsolata.ttf",16,100),
				scroll_transition_dt:0.1,
				bgcolor_selection:C_sel,
				color:0xff000000,
				state_handlers:["renderer_programmer","colorer_programmer","line_column_unicode","seeker_indentation"],
				read_only:1,
				$:{
					focus:{
						bgcolor_selection:C_sel,
					},
					blur:{
						bgcolor_selection:0xffcccccc,
					},
				}
			},
		},
		sxs_new_page:{
			color:0xffffffff,
			border_color:0xff000000,
			border_width:0,
			round:0,
			//////////////////////
			h_find_bar:32,
			find_bar_bgcolor:0xffffffff,
			find_bar_color:0xffe8e8e8,
			find_bar_round:8,
			find_bar_padding:4,
			find_bar_hint_color:0xff7f7f7f,
			find_bar_shadow_color:0x7f000000,
			find_bar_shadow_size:8,
			find_bar_hint_font:UI.Font("res/fonts/opensans.ttf",20,-50),
			find_bar_button_size:28,
			find_bar_editor_style:{
				font:UI.Font("res/fonts/inconsolata.ttf",20),
				color:0xff000000,
				bgcolor_selection:C[0]&0x3fffffff,
				tab_width:4,
			},
		},
		file_item:{
			h:56,h_icon:48,
			file_icon_color:0xff444444,
			name_font:UI.Font("res/fonts/opensans.ttf",24,-50),
			name_font_bold:UI.Font("res/fonts/opensans.ttf",24,100),
			misc_font:UI.Font("res/fonts/opensans.ttf",18,-50),
			name_color:0xff000000,
			misc_color:0xff7f7f7f,
			basepath_color:0xffcccccc,
			sel_bgcolor:C[0],
			sel_file_icon_color:0xffffffff,
			sel_name_color:0xffffffff,
			sel_misc_color:0xffcccccc,
			sel_basepath_color:0xffcccccc,
			tag_padding:4,
			tag_round:8,
			tag_border_width:0,
			button_style:{
				transition_dt:0.1,
				font:UI.Font("res/fonts/opensans.ttf",24,-50),
				round:0,border_width:2,padding:6,
				color:0,
				$:{
					out:{
						border_color:0x00ffffff,
						text_color:0xffcccccc,
					},
					over:{
						border_color:0xffffffff,
						text_color:0xffffffff,
					},
					down:{
						border_color:0xffe8e8e8,
						text_color:0xffe8e8e8,
					},
				}
			},
		},
		top_menu:{
			//nothing
		},
		top_menu_item:{
			font:UI.Font(UI.font_name,22,-100),
			padding:8,
			$:{
				active:{
					color:C[0],
					text_color:0xffffffff,
				},
				inactive:{
					color:0,
					text_color:0xff000000,
				},
			},
		},
		fancy_menu:{
			color:0xffe8e8e8,
			border_color:0xff444444,
			border_width:1,round:1,
			shadow_color:0xaa000000,
			shadow_size:12,
			///////////
			font:UI.Font(UI.font_name,22,-100),
			text_color:0xff000000,
			text_sel_color:0xffffffff,
			hotkey_color:0xff7f7f7f,
			hotkey_sel_color:0xffaaaaaa,
			sel_bgcolor:C[0],
			///////////
			vertical_padding:4,
			side_padding:8,
			column_padding:32,
			button_padding:4,
			///////////
			h_separator:8,
			h_separator_fill:1,
			separator_color:0xffd0d0d0,
			h_menu_line:32,
			h_button:28,
			w_icon:24,
			button_style:{
				transition_dt:0.1,
				round:0.1,border_width:1,padding:0,
				font:UI.Font(UI.font_name,20,-100),
				icon_font:UI.Font(UI.icon_font_name,18),
				$:{
					out:{
						//border_color:0xff444444,color:0xffffffff,
						border_color:0xff444444,color:[{x:0,y:0,color:0xffffffff},{x:0,y:1,color:0xffe8e8e8}],
						icon_color:0xff000000,
						text_color:0xff000000,
					},
					over:{
						border_color:C[0],color:C[0],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					down:{
						border_color:C_dark,color:C_dark,
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					checked_out:{
						border_color:C[0],color:C[0],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					checked_over:{
						border_color:C[0],color:C[0],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
					checked_down:{
						border_color:C[0],color:C[0],
						icon_color:0xffffffff,
						text_color:0xffffffff,
					},
				}
			},
		},
	};
	var s0=UI.default_styles;
	for(var key in custom_styles){
		s0[key]=custom_styles[key]
	}
	s0.scroll_bar.middle_bar.color=0xff444444
}
if(UI.Platform.BUILD=="debug"){
	UI.Theme_Minimalistic([0xff3377cc])
}else{
	UI.Theme_Minimalistic([0xffcc7733])
}
UI.icon_font=UI.Font(UI.icon_font_name,24);
UI.icon_font_20=UI.Font(UI.icon_font_name,20);
UI.SetRetardedWindingOrder(UI.core_font_cache['res/fonts/iconfnt.ttf'])
UI.font_name="res/fonts/opensans.ttf"
UI.eng_font_name="res/fonts/opensans.ttf,!"

var g_all_document_windows=[];
UI.g_all_document_windows=g_all_document_windows
UI.NewTab=function(tab){
	g_all_document_windows.push(tab)
	UI.Refresh()
	return tab;
}

var ZOOM_RATE=1.0625
UI.UpdateZoom=function(){
	UI.ResetRenderer(UI.pixels_per_unit);
	UI.Refresh()
	UI.m_ui_metadata.zoom=(UI.pixels_per_unit/UI.pixels_per_unit_base)
}
UI.ZoomRelative=function(rate){
	UI.pixels_per_unit*=rate;
	UI.UpdateZoom()
}
UI.ZoomReset=function(){
	UI.pixels_per_unit=UI.pixels_per_unit_base
	UI.UpdateZoom()
}

var g_app_inited=0
UI.Application=function(id,attrs){
	attrs=UI.Keep(id,attrs);
	UI.Begin(attrs);
		///////////////////
		var app=UI.Begin(W.Window('app',{
				title:'UI Editor',w:1280,h:720,bgcolor:0xfff0f0f0,icon:"res/icon256.png",
				flags:UI.SDL_WINDOW_MAXIMIZED|UI.SDL_WINDOW_RESIZABLE,
				is_main_window:1,
				OnWindowBlur:function(){
					this.document_area.OnWindowBlur();
				},
				OnMenu:function(){
					this.document_area.OnMenu();
				},
				OnClose:function(){
					return this.document_area.OnClose();
				}}));
			if(UI.Platform.ARCH!="mac"&&UI.Platform.ARCH!="ios"){
				W.Hotkey("",{key:"ALT+F4",action:function(){if(!app.OnClose()){UI.DestroyWindow(app)}}});
			}
			var w_property_bar=320;
			//UI.Platform.ARCH=='android'?(app.w<app.h?'down':'left'):
			//var obj_panel=W.AutoHidePanel("property_panel",{
			//	x:0,y:0,w:w_property_bar,h:w_property_bar,initial_position:0,
			//	max_velocity:16000,acceleration:10000,velocity_to_target_threshold:0.005,
			//	anchor_placement:'right',//(app.w<app.h?'down':'right'),
			//	knob_size:UI.IS_MOBILE?40:4,
			//});
			//var reg_panel=UI.context_regions.pop()
			//var panel_placement=obj_panel.anchor_placement
			UI.document_property_sheet={};
			//if(panel_placement=='down'){
			//	W.TabbedDocument("document_area",{
			//		'anchor':'parent','anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':0,'h':obj_panel.y,
			//		items:g_all_document_windows,
			//		Close:function(){UI.DestroyWindow(app)},
			//	})
			//}else{
			W.TabbedDocument("document_area",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':app.w,//obj_panel.x,
				items:g_all_document_windows,
				Close:function(){UI.DestroyWindow(app)},
			})
			//}
			var property_windows=[]
			if(app.document_area.active_tab){
				property_windows=(app.document_area.active_tab.property_windows||property_windows);
			}
			//UI.context_regions.push(reg_panel)
			//////////////////////////
			//var w_shadow=6
			//var w_bar=4;
			//var shadow_color=0xaa000000
			//if(panel_placement=='down'){
			//	UI.RoundRect({
			//		x:-w_shadow,y:obj_panel.y-w_bar-w_shadow,w:app.w+w_shadow*2,h:w_shadow*2,
			//		color:shadow_color,border_width:-w_shadow,round:w_shadow,
			//	})
			//	UI.RoundRect({
			//		x:0,y:obj_panel.y-w_bar,w:app.w,h:w_property_bar,
			//		color:0xfff0f0f0,border_width:0,
			//	})
			//	W.Group("property_bar",{
			//		'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':0,'h':w_property_bar,
			//		item_template:{'object_type':W.SubWindow},items:property_windows,
			//		///////////
			//		'layout_direction':'right','layout_spacing':0,'layout_align':'left','layout_valign':'fill',
			//		'property_sheet':UI.document_property_sheet,
			//	});
			//	W.RoundRect("",{
			//		'anchor':obj_panel,'anchor_align':"fill",'anchor_valign':"up",
			//		'x':0,'y':-w_bar,'h':w_bar,
			//		'color':UI.current_theme_color,
			//	})
			//}else{
			//UI.RoundRect({
			//	x:obj_panel.x-w_bar-w_shadow,y:-w_shadow,w:w_shadow*2,h:app.h+w_shadow*2,
			//	color:shadow_color,border_width:-w_shadow,round:w_shadow,
			//})
			//UI.RoundRect({
			//	x:obj_panel.x-w_bar,y:0,w:w_property_bar,h:app.h,
			//	color:0xfff0f0f0,border_width:0,
			//})
			//W.Group("property_bar",{
			//	'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
			//	'x':0,'y':0,'w':w_property_bar,
			//	item_template:{'object_type':W.SubWindow},items:property_windows,
			//	///////////
			//	'layout_direction':'down','layout_spacing':0,'layout_align':'fill','layout_valign':'up',
			//	'property_sheet':UI.document_property_sheet,
			//});
			//W.RoundRect("",{
			//	'anchor':obj_panel,'anchor_align':"left",'anchor_valign':"fill",
			//	'x':-w_bar,'y':0,'w':w_bar,
			//	'color':UI.current_theme_color,
			//})
			//}
			//////////////////////////
			var menu_file=UI.BigMenu("&File")
			menu_file.AddNormalItem({text:"&New",icon:'新',key:"CTRL+N",enable_hotkey:1,action:function(){
				UI.UpdateNewDocumentSearchPath()
				UI.NewCodeEditorTab()
				UI.Refresh()
			}})
			menu_file.AddNormalItem({text:"&Open",icon:'开',key:"CTRL+O",enable_hotkey:1,action:function(){
				var fn=IO.DoFileDialog(["Text documents (*.text)","*.text","All File","*.*"]);
				if(!fn){return;}
				UI.OpenFile(fn.replace(new RegExp("\\\\","g"),"/"));
				UI.Refresh()
			}});
			menu_file.AddNormalItem({text:"&Save",key:"CTRL+S",icon:'存',enable_hotkey:1,action:function(){
				app.document_area.SaveCurrent();
			}});
			menu_file.AddNormalItem({text:"Save a&ll",icon:'保',action:function(){
				app.document_area.SaveAll();
			}});
			menu_file.AddSeparator();
			W.Hotkey("",{key:"CTRL+-",action:function(){UI.ZoomRelative(1/ZOOM_RATE)}});
			W.Hotkey("",{key:"CTRL+0",action:function(){UI.ZoomReset()}});
			W.Hotkey("",{key:"CTRL+=",action:function(){UI.ZoomRelative(ZOOM_RATE)}});
			menu_file.AddButtonRow({icon:"扩",text:"Zoom"},[
				{text:"-",tooltip:'CTRL -',action:function(){
					UI.ZoomRelative(1/ZOOM_RATE)
				}},{text:"reset",tooltip:'CTRL+0',action:function(){
					UI.ZoomReset()
				}},{text:"+",tooltip:'CTRL +',action:function(){
					UI.ZoomRelative(ZOOM_RATE)
				}}])
			//todo: drag-loading
			if(!UI.Platform.IS_MOBILE){
				//OS shell
				menu_file.AddSeparator();
				menu_file.AddNormalItem({text:"Open shell (&D)...",icon:'控',enable_hotkey:0,action:function(){
					UI.UpdateNewDocumentSearchPath()
					if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
						IO.Shell(["start"," ","cmd","/k","cd","/d",UI.m_new_document_search_path])
					}else if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
						IO.Shell(["xterm",
							"-e",'cd '+UI.m_new_document_search_path+'; bash'])
					}else{
						//mac
						//http://stackoverflow.com/questions/7171725/open-new-terminal-tab-from-command-line-mac-os-x
						IO.Shell(["osascript",
							"-e",'tell application "Terminal" to activate',
							"-e",'tell application "System Events" to tell process "Terminal" to keystroke "t" using command down',
							"-e",'tell application "Terminal" to do script "cd '+UI.m_new_document_search_path+'" in selected tab of the front window'
						])
					}
				}})
			}
			menu_file.AddSeparator();
			menu_file.AddNormalItem({icon:"时",text:"Recen&t...",key:"ALT+Q",enable_hotkey:1,action:function(){
				var active_document=UI.m_the_document_area.active_tab
				if(active_document&&active_document.doc&&active_document.doc.m_is_brand_new){
					return;
				}
				UI.UpdateNewDocumentSearchPath()
				UI.NewCodeEditorTab().auto_focus_file_search=1
				UI.Refresh()
			}})
			menu_file.AddSeparator();
			menu_file.AddNormalItem({text:"E&xit",action:function(){
				if(!app.OnClose()){UI.DestroyWindow(app)}
			}});
		UI.End();
	UI.End();
	if(!g_app_inited){
		var workspace=UI.m_ui_metadata["<workspace>"]
		var fn_current_tab=UI.m_ui_metadata["<current_tab>"]
		if(workspace){
			var current_tab_id=undefined
			for(var i=0;i<workspace.length;i++){
				UI.NewCodeEditorTab(workspace[i])
				if(workspace[i]==fn_current_tab){
					current_tab_id=i;
				}
			}
			if(current_tab_id!=undefined){
				UI.top.app.document_area.SetTab(current_tab_id)
				UI.top.app.document_area.n_tabs_last_checked=g_all_document_windows.length
			}
			UI.InvalidateCurrentFrame();
			UI.Refresh()
		}
		g_app_inited=1
	}
	if(!g_all_document_windows.length){
		//UI.NewUIEditorTab()
		//UI.NewCodeEditorTab()
		//UI.OpenFile("c:/tp/kara/ide/edcore.spap")
		//UI.OpenFile("c:/h/edtest/empty.tex")
		//UI.OpenFile("c:/tp/papers/ours/vg2015/gpu_scanline.tex")
		//UI.OpenFile("C:/tp/qpad/history.xml")
		//UI.NewFromTemplate("templates/blank_demo.mo")
		//c:\tp\pure\mo\pm_tmp\win32\mo\s7main.c
		//UI.OpenFile("C:/h/syousetu/stars_tr.md")
		//UI.OpenFile("c:/h/edtest/crap.c")
		//UI.UpdateNewDocumentSearchPath()
		UI.m_new_document_search_path=IO.GetNewDocumentName(undefined,undefined,"document");
		UI.m_previous_document=undefined
		UI.NewCodeEditorTab().auto_focus_file_search=1
		UI.Refresh()
	}
};

UI.Run()
