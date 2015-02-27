var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/dockbar");
require("res/lib/txtx_editor");
require("res/lib/subwin");

var g_icon_font=UI.Font('res/fonts/iconfnt.ttf,!',24,0);
UI.SetFontSharpening(1.5)
UI.default_styles={
	button:{
		transition_dt:0.1,
		round:4,border_width:3,padding:12,
		$:{
			out:{
				border_width:0,
				border_color:0x00ffffff,color:0x00ffffff,
				icon_color:0xffcc773f,
				text_color:0xffcc773f,
			},
			over:{
				border_color:0xffcc773f,color:0xffcc773f,
				icon_color:0xffffffff,
				text_color:0xffffffff,
			},
			down:{
				border_color:0xffaa5522,color:0xffaa5522,
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
				border_color:0xffcc773f,color:0xffcc773f,
				icon_color:0xffffffff,
				text_color:0xffffffff,
			},
		},
	},
	menu:{
		transition_dt:0.1,
		round:0,border_width:2,padding:8,
		layout_spacing:0,
		border_color:0xffcc773f,color:0xffffffff,
	},
	combobox:{
		transition_dt:0.1,
		round:8,border_width:2,padding:8,
		layout_spacing:0,
		border_color:0xffcc773f,icon_color:0xffcc773f,text_color:0xff000000,color:0xffffffff,icon_text_align:'left',
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
		color:0xffffffff,border_color:0xffcc773f,border_width:2,
		caption_color:0xffcc773f,text_color:0xffdddddd,
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
		shadow_color:0x80000000, shadow_size:6,
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
		h_caption:32, h_bar:4, color:0xffbbbbbb,
	},
};
var g_all_property_windows=[
	{
		'title':'Text properties',h:114,
		body:function(){
			/*widget*/(W.Button('bold',{
				'x':13.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'B',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('italic',{
				'x':45.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'I',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('underlined',{
				'x':77.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'U',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('super',{
				'x':109.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'^',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('sub',{
				'x':141.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'_',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('align_l',{
				'x':176.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'1',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('align_c',{
				'x':208.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'2',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.Button('align_r',{
				'x':240.02037844241704,'y':74,'w':32,'h':32,
				font:g_icon_font,text:'3',
				OnClick:function(){/*todo*/}}));
			/*widget*/(W.ComboBox("font_box",{
				'x':13.02037844241704,'y':36,'w':166.83966387238038,'h':29,
				items:[
					{text:"Serif"},
					{text:"Sans"},
					{text:"Typewriter"},
				],
			}));
			/*widget*/(W.ComboBox("size_box",{
				'x':191.0906294148415,'y':36,'w':80.92974902757557,'h':29,
				items:[
					{text:"Tiny"},
					{text:"Small"},
					{text:"Normal"},
					{text:"Large"},
					{text:"Huge"},
				],
			}));
		}
	}
];

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
var g_all_document_windows=[{
		color:0xffcc773f,title:"Document 0",
		body:function(){
			//todo
		},
	},{
		color:0xff3f77cc,title:"Document 1",
		body:function(){
			//todo
		},
	},
]
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
			//todo: device-dependent button dimensions
			//W.DockingLayout("dockbar",{anchor:UI.context_parent,anchor_align:"fill",anchor_valign:"fill",layout:g_layout})
			//W.RoundRect("",{x:4,y:128, w:80+12,h:256+12,border_width:-6,round:20,color:0x80000000});
			//W.RoundRect("",{x:4,y:128, w:80,h:256,round:16,color:[{x:0,y:0,color:0xffffffff},{x:1,y:0,color:0xffd0d0d0}]});
			var w_bar=2;
			W.Group("property_bar",{
				'anchor':'parent','anchor_align':"right",'anchor_valign':"fill",
				'x':0,'y':0,'w':320,
				item_template:{'object_type':W.SubWindow},items:g_all_property_windows,
				///////////
				'layout_direction':'down','layout_spacing':0,'layout_align':'fill','layout_valign':'up',
			});
			W.TabbedDocument("document_area",{
				'anchor':'parent','anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':UI.top.app.w-UI.top.app.property_bar.w,
				items:g_all_document_windows,
			})
			W.RoundRect("-",{
				'anchor':UI.top.app.property_bar,'anchor_align':"left",'anchor_valign':"fill",
				'x':0,'y':0,'w':w_bar,
				color:0xffcc773f,
			})
		UI.End();
	UI.End();
};

UI.Run()
