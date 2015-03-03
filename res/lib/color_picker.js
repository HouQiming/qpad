var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
require("gui2d/gl");

var g_tech=UI.glCreateTechnique()
g_tech.SetVertexShader("void main(){vec2 P_scr=P*scale;gl_Position=vec4(P_scr.x-1.0,1.0-P_scr.y,1.0,1.0);Ci=Cs;}")
g_tech.SetFragmentShader(IO.UIReadAll("res/lib/fs_color_picker.glsl"))
g_tech.SetVarying("vec4 Ci")

W.ColorPickerPrototype={
	value:0xffffffff,
	mode:"rgb",
	OnChange:function(value){this.value=value;}
}
W.ColorPicker=function(id,attrs){
	var obj=UI.StdWidget(id,attrs,"color_picker",W.ColorPickerPrototype)
	var C=obj.value;
	UI.GLWidget(function(){
		//3 quads, float4 (2P+1C),
		var C=obj.value;
		var vbo=UI.glCreateCPUBuffer(12*12)
		var P_arr=[],C_arr=[];
		var x0,y0,x1,y1,C0,C1;
		x0=obj.x+obj.w_text;x1=x0+obj.w_slider
		////////////
		y0=obj.y
		y1=y0+obj.h_slider
		C0=(C&~0xff)
		C1=(C|0xff)
		P_arr.push(x0,y0,x1,y0,x1,y1,x0,y1)
		C_arr.push(C0,C1,C1,C0)
		////////////
		y0=y1+obj.h_space
		y1=y0+obj.h_slider
		C0=(C&~0xff00)
		C1=(C|0xff00)
		P_arr.push(x0,y0,x1,y0,x1,y1,x0,y1)
		C_arr.push(C0,C1,C1,C0)
		////////////
		y0=y1+obj.h_space
		y1=y0+obj.h_slider
		C0=(C&~0xff0000)
		C1=(C|0xff0000)
		P_arr.push(x0,y0,x1,y0,x1,y1,x0,y1)
		C_arr.push(C0,C1,C1,C0)
		g_tech.SetStandardUniforms();
		g_tech.SetUniform("is_hsv",[(obj.mode=="hsv")])
		vbo.Write(0,"float",P_arr)
		vbo.Write(24*4,"int",C_arr)
		g_tech.SetVBO(vbo)
		g_tech.SetVertexPointer("P", 2,UI.GL_FLOAT,0, 0,0)
		g_tech.SetVertexPointer("Cs", 4,UI.GL_UNSIGNED_BYTE,1, 0,24*4)
		g_tech.Draw(UI.GL_QUADS,12)
	})
	UI.Begin(obj)
		var x0,y0,x1,y1,slider;
		////////////
		var style_owner_drawn_slider={
			//transition_dt:0,
			//bgcolor:0,
			//round:0,
			//color:0,
			//padding:0,
			label_text:'▲',
			label_raise:0.35,
			label_font:UI.Font("res/fonts/opensans.ttf,!",48),
			label_color:0xff000000,
			middle_bar:{
				w:2,h:8,
				color:0xff444444,
			},
		};
		x0=obj.x+obj.w_text;x1=x0+obj.w_slider
		y1=obj.y-obj.h_space
		////////////
		var labels=(obj.mode=="hsv"?['H','S','V']:['R','G','B'])
		for(var i=0;i<3;i++){(function(i){
			y0=y1+obj.h_space
			y1=y0+obj.h_slider
			slider=W.Slider("slider"+i,{x:x0,y:y0,w:x1-x0,h:y1-y0,
				style:style_owner_drawn_slider,value:((C>>(i*8))&0xff)/255.0,
				OnChange:function(value){
					obj.OnChange((C&~(0xff<<(i*8)))|((Math.max(Math.min((value*255.0)|0,255),0)||0)<<(i*8)))
				},
			})
			W.Text("label"+i,{
				anchor:slider,anchor_placement:'left',anchor_valign:'center',
				x:obj.padding,y:0,font:obj.font,color:obj.text_color,text:labels[i],
			})
			W.EditBox("edit"+i,{
				anchor:slider,anchor_placement:'right',anchor_valign:'fill',
				x:obj.padding,y:0,w:obj.w_edit,
				font:obj.font,value:(((C>>(i*8))&0xff)/255.0).toFixed(2),
				OnChange:function(value){
					obj.OnChange((C&~(0xff<<(i*8)))|((Math.max(Math.min((parseFloat(value)*255.0)|0,255),0)||0)<<(i*8)))
				},
			})
		})(i)}
		//todo: SelectionWidget for rgb-hsv
	UI.End()
	return obj
}