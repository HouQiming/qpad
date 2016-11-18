var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");
require("res/lib/notebook_v2");

Language.RegisterFileIcon("M",["png","jpg","jpeg", "gif","tif","tiff", "bmp","ppm","webp","ico", "tga","dds","exr","iff","pfm","hdr"]);
Language.RegisterFileIcon("V",["mp4","mpg","mpeg","h264","avi","mov","rm","rmvb"]);
Language.RegisterFileIcon("文",["txt"]);

var f_C_like=function(lang,keywords,has_preprocessor,objc_keywords){
	lang.DefineDefaultColor("color_symbol")
	var tok_newline=lang.DefineToken("\n");
	var bid_preprocessor
	if(has_preprocessor){
		bid_preprocessor=lang.ColoredDelimiter("key","#","\n","color_meta");
	}else{
		bid_preprocessor=bid_comment;
	}
	var tok_comment0=lang.DefineToken("/*");
	var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
	var bid_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
	var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
	var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken("\\\\")
	lang.DefineToken("\\'")
	lang.DefineToken('\\"')
	lang.DefineToken('\\\n')
	var kwset=lang.DefineKeywordSet("color_symbol");
	for(var k in keywords){
		kwset.DefineKeywords("color_"+k,keywords[k])
	}
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	lang.SetKeyDeclsBaseColor("color")
	if(objc_keywords){
		var kwset2=lang.DefineKeywordSet("color_symbol","@");
		for(var k in objc_keywords){
			kwset2.DefineKeywords("color_"+k,objc_keywords[k])
		}
	}
	return (function(lang){
		if(has_preprocessor){
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2,bid_preprocessor]);
			if(lang.isInside(bid_preprocessor)){
				lang.Enable(bid_comment);
				//lang.Enable(bid_comment2);
				lang.EnableToken(tok_comment0);
			}
		}else{
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2]);
		}
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)||has_preprocessor&&lang.isInside(bid_preprocessor)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
		lang.EnableToken(tok_newline);
	});
};

var g_regexp_backslash=new RegExp("\\\\","g");
var g_regexp_slash=new RegExp("/","g");
var ProcessIncludePaths=function(paths){
	var ret=[]
	for(var i=0;i<paths.length;i++){
		var path_i=IO.ProcessUnixFileName(paths[i]);
		var paths_i=path_i.split(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?";":":");
		for(var j=0;j<paths_i.length;j++){
			if(IO.DirExists(paths_i[j])){
				ret.push(paths_i[j].replace(g_regexp_backslash,"/"))
			}
		}
	}
	return ret
}

var standard_c_include_paths=ProcessIncludePaths(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?[
	"%INCLUDE%",
	"%VS140COMNTOOLS%../../VC/include",
	"%VS130COMNTOOLS%../../VC/include",
	"%VS120COMNTOOLS%../../VC/include",
	"%VS110COMNTOOLS%../../VC/include",
	"%VS100COMNTOOLS%../../VC/include",
	"%VS90COMNTOOLS%../../VC/include",
	"%VS80COMNTOOLS%../../VC/include",
	"%ProgramFiles(x86)%/Windows Kits/10/Include/um",
	"%ProgramFiles(x86)%/Windows Kits/10/Include/shared",
	"%ProgramFiles(x86)%/Windows Kits/10/Include/winrt",
	"%ProgramFiles(x86)%/Windows Kits/8.1/Include/um",
	"%ProgramFiles(x86)%/Windows Kits/8.1/Include/shared",
	"%ProgramFiles(x86)%/Windows Kits/8.1/Include/winrt",
	"%ProgramFiles(x86)%/Windows Kits/8.0/Include/um",
	"%ProgramFiles(x86)%/Windows Kits/8.0/Include/shared",
	"%ProgramFiles(x86)%/Windows Kits/8.0/Include/winrt",
	"%VS90COMNTOOLS%../../../Microsoft SDKs/Windows/v5.0/Include",
	"c:/mingw/include"
]:[
	"${INCLUDE}",
	"/usr/include",
	"/usr/local/include",
	//todo: mac paths
]);

Language.Register({
	name:"C/C++/C#",parser:"C",
	extensions:["c","cxx","cpp","cc","h","hpp","mm","cs","qinfo"],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1,'class':2,'struct':2,'union':2,'namespace':2},
	has_pointer_ops:1,
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	port_template:{
		'in':"//@in=___,type=c_code code,format=indented",
		'out':"//@out=___,type=c_code code",
	},
	rules:function(lang){
		return f_C_like(lang,{
			keyword:['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using'],
			type:['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t','size_t']
		},1,{
			//objective C @... keywords
			keyword:[
				'interface','end','implementation','protocol','class','public','protected','private','try','throw','catch','finally',
				'synthesize','dynamic','selector']
		})
	},
	include_paths:standard_c_include_paths
})

//Language.Register({
//	name:'SPAP#',parser:"C",
//	extensions:['spap'],
//	has_dlist_type:1,
//	has_pointer_ops:1,
//	indent_as_parenthesis:1,
//	file_icon_color:0xff9a3d6a,
//	file_icon:'プ',
//	rules:function(lang){
//		return f_C_like(lang,{
//			'keyword':['enum','if','else','elif','switch','case','default','break','continue','goto','return','for','while','do','loop','const','static','struct','union','class','function','F','sizeof','new','delete','import','export','typedef','stdcall','inline','operator','forall','foreach','in','this','module','project','true','false','abstract','interface','virtual','__host__','__device__','__operation__'],
//			'meta':['If','Else','Elif','For','Switch','Case','Default','#include','#flavor','#make'],
//			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','string','Object','Interface','typename','typeof'],
//		},0)
//	}
//});

Language.Register({
	name:'Jacy',parser:"C",
	extensions:['jc','spap'],
	indent_as_parenthesis:1,
	has_post_ctor_initializer:1,
	auto_include:['__builtin.jc'],
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	port_template:{
		'in':"//@in=___,type=jc_code code,format=indented",
		'out':"//@out=___,type=jc_code code",
	},
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','if','else','elif','switch','case','default','break','continue','return','for','const','struct','class','function','sizeof','new','delete','import','export','typedef','inline','__inline_loop_body','operator','foreach','in','this','module','true','false','while'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','string','Object','Interface','typename','typeof'],
		},0)
	},
	include_paths:ProcessIncludePaths(['c:/tp/pure/units',UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?'%JC_PATH%/units':'${JC_PATH}/units'])
});

Language.Register({
	name:'Microsoft IDL',parser:"C",
	extensions:['idl'],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1,'class':2,'struct':2,'union':2,'namespace':2},
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','interface','coclass','midl_pragma','import','library','cpp_quote','const','typedef','extern','struct','union'],
		},1)
	}
});

Language.Register({
	name:'HLSL shader',parser:"C",
	extensions:['hlsl'],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'class':2,'struct':2,'union':2},
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['AppendStructuredBuffer','Asm','Asm_fragment','Break','Centroid','Column_major','Compile','Compile_fragment','CompileShader','Const','Continue','ComputeShader','Discard','Do','DomainShader','Else','Extern','False','For','Fxgroup','GeometryShader','Groupshared','Hullshader','If','In','Inline','Inout','InputPatch','Interface','Line','Lineadj','Linear','LineStream','Namespace','Nointerpolation','Noperspective','NULL','Out','OutputPatch','Packoffset','Pass','Pixelfragment','PixelShader','Precise','Return','Register','Row_major','Shared','Snorm','Stateblock','Stateblock_state','Static','Struct','Switch','True','Typedef','Triangle','Triangleadj','TriangleStream','Uniform','Unorm','Vertexfragment','VertexShader','Void','Volatile','While','appendstructuredbuffer','asm','asm_fragment','break','centroid','column_major','compile','compile_fragment','compileshader','const','continue','computeshader','discard','do','domainshader','else','extern','false','for','fxgroup','geometryshader','groupshared','hullshader','if','in','inline','inout','inputpatch','interface','line','lineadj','linear','linestream','namespace','nointerpolation','noperspective','null','out','outputpatch','packoffset','pass','pixelfragment','pixelshader','precise','return','register','row_major','shared','snorm','stateblock','stateblock_state','static','struct','switch','true','typedef','triangle','triangleadj','trianglestream','uniform','unorm','vertexfragment','vertexshader','void','volatile','while'],
			'type':['BlendState','Bool','Buffer','ByteAddressBuffer','CBuffer','ConsumeStructuredBuffer','DepthStencilState','DepthStencilView','Double','Dword','Float','Half','Int','Matrix','Min16float','Min10float','Min16int','Min12int','Min16uint','Point','PointStream','RasterizerState','RenderTargetView','RWBuffer','RWByteAddressBuffer','RWStructuredBuffer','RWTexture1D','RWTexture1DArray','RWTexture2D','RWTexture2DArray','RWTexture3D','Sampler','Sampler1D','Sampler2D','Sampler3D','SamplerCUBE','Sampler_State','SamplerState','SamplerComparisonState','String','StructuredBuffer','TBuffer','Technique','Technique10','Technique11xz','texture1','Texture1D','Texture1DArray','Texture2D','Texture2DArray','Texture2DMS','Texture2DMSArray','Texture3D','TextureCube','TextureCubeArray','Uint','Vector','blendstate','bool','buffer','byteaddressbuffer','cbuffer','consumestructuredbuffer','depthstencilstate','depthstencilview','double','dword','float','half','int','matrix','min16float','min10float','min16int','min12int','min16uint','point','pointstream','rasterizerstate','rendertargetview','rwbuffer','rwbyteaddressbuffer','rwstructuredbuffer','rwtexture1d','rwtexture1darray','rwtexture2d','rwtexture2darray','rwtexture3d','sampler','sampler1d','sampler2d','sampler3d','samplercube','sampler_state','samplerstate','samplercomparisonstate','string','structuredbuffer','tbuffer','technique','technique10','technique11xz','texture1','texture1d','texture1darray','texture2d','texture2darray','texture2dms','texture2dmsarray','texture3d','texturecube','texturecubearray','uint','vector','float2','float3','float4','int2','int3','int4','uint2','uint3','uint4'],
		},1)
	}
});

Language.Register({
	name:'GLSL shader',parser:"C",
	extensions:['glsl','essl'],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'class':2,'struct':2,'union':2},
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using','attribute','uniform','varying','layout','centroid','flat','smooth','noperspective','patch','sample','subroutine','in','out','inout','invariant','discard','lowp','mediump','highp','precision'],
			'type':['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t','mat2','mat3','mat4','dmat2','dmat3','dmat4','mat2x2','mat2x3','mat2x4','dmat2x2','dmat2x3','dmat2x4','mat3x2','mat3x3','mat3x4','dmat3x2','dmat3x3','dmat3x4','mat4x2','mat4x3','mat4x4','dmat4x2','dmat4x3','dmat4x4','vec2','vec3','vec4','ivec2','ivec3','ivec4','bvec2','bvec3','bvec4','dvec2','dvec3','dvec4','uvec2','uvec3','uvec4','sampler1D','sampler2D','sampler3D','samplerCube','sampler1DShadow','sampler2DShadow','samplerCubeShadow','sampler1DArray','sampler2DArray','sampler1DArrayShadow','sampler2DArrayShadow','isampler1D','isampler2D','isampler3D','isamplerCube','isampler1DArray','isampler2DArray','usampler1D','usampler2D','usampler3D','usamplerCube','usampler1DArray','usampler2DArray','sampler2DRect','sampler2DRectShadow','isampler2DRect','usampler2DRect','samplerBuffer','isamplerBuffer','usamplerBuffer','sampler2DMS','isampler2DMS','usampler2DMS','sampler2DMSArray','isampler2DMSArray','usampler2DMSArray','samplerCubeArray','samplerCubeArrayShadow','isamplerCubeArray','usamplerCubeArray'],
		},1)
	}
});

Language.Register({
	name:'Java',parser:"C",
	extensions:['java'],
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['abstract','assert','break','case','catch','class','const','continue','default','do','else','enum','extends','final','finally','for','goto','if','implements','import','instanceof','interface','native','new','package','private','protected','public','return','static','strictfp','super','switch','synchronized','this','throw','throws','transient','try','while','false','null','true'],
			'type':['volatile','byte','long','char','boolean','double','float','int','short','void','Object'],
		},0)
	}
});

Language.Register({
	name:'BSGP',parser:"C",
	extensions:['i'],
	auto_include:['system.i'],
	has_dlist_type:1,
	has_pointer_ops:1,
	indent_as_parenthesis:1,
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['if','else','elif','switch','case','default','break','continue','goto','return','for','while','do','loop','const','static','struct','union','class','namespace','function','Func','sizeof','new','delete','import','export','typedef','stdcall','inline','__fastcall','with','operator','forall','this','uses','need','using','autouses','require','spawn','__interrupt__','__both__','__device__','__host__','__shared__','barrier','par','novirtual','__force_template','try','catch','finally','throw','classof'],
			'meta':['def','If','Else','Elif','For','Switch','Case','Default','#define','#include','#def','#undef'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','typename','typeof'],
		},0)
	}
});

Language.Register({
	name:'CUDA',parser:"C",
	extensions:['cu','cuh'],
	auto_include:['cuda.h'],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1,'class':2,'struct':2,'union':2,'namespace':2,'__global__':1,'__device__':1,'__host__':1},
	has_pointer_ops:1,
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','__global__','__device__','__host__','__shared__','__constant__'],
			'type':['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t','texture','surface',
				'float2','float3','float4',
				'char2','char3','char4',
				'short2','short3','short4',
				'int2','int3','int4',
				'uchar2','uchar3','uchar4',
				'ushort2','ushort3','ushort4',
				'uint2','uint3','uint4'],
		},1)
	},
	include_paths:standard_c_include_paths
});

Language.Register({
	name:'Javascript',parser:"C",
	has_backquote_string:1,
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1},
	extensions:['js','json'],
	file_icon_color:0xffb4771f,
	file_icon:'プ',
	port_template:{
		'in':"//@in=___,type=js_code code,format=indented",
		'out':"//@out=___,type=js_code code",
	},
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		//match (/, but only count the '/' part as the token
		var tok_regexp_thing=lang.DefineToken("(/",1);
		var tok_regexp_thing2=lang.DefineToken("=/",1);
		var tok_regexp_thing3=lang.DefineToken("= /",1);
		var tok_regexp_end=lang.DefineToken("/");
		var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
		var bid_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
		var bid_regexp=lang.ColoredDelimiter("key",[tok_regexp_thing,tok_regexp_thing2,tok_regexp_thing3],tok_regexp_end,"color_string");
		var bid_string_param=lang.DefineDelimiter("key","${","}");
		var bid_regexp_charset=lang.ColoredDelimiter("key","[","]","color_string");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_string_es6=lang.ColoredDelimiter("key","`","`","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{','${'],['}',']',')']);
		//this rule takes priority over bid_string_es6
		var crid_string_param=lang.AddColorRule(bid_string_param,"color_symbol","exclusive");
		lang.DefineToken("\\\\")
		lang.DefineToken("\\'")
		lang.DefineToken('\\"')
		lang.DefineToken('\\\n')
		var tok_sqaure_bracket0=lang.DefineToken("[");
		var tok_sqaure_bracket1=lang.DefineToken("]");
		var tok_regexp_escape=lang.DefineToken("\\/");
		var tok_regexp_escape1=lang.DefineToken("\\[");
		var tok_regexp_escape2=lang.DefineToken("\\]");
		var tok_es6_string_param_left=lang.DefineToken("${");
		var tok_curly_bracket1=lang.DefineToken("}");
		var kwset=lang.DefineKeywordSet("color_symbol");
		var keywords={
			'keyword':['break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super','undefined','yield','await'],
			'type':['typeof','var','let','void','boolean','byte','int','short','char','double','long','float'],
		};
		for(var k in keywords){
			kwset.DefineKeywords("color_"+k,keywords[k])
		}
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		lang.BindKeywordSet(crid_string_param,kwset);
		////////
		lang.SetKeyDeclsBaseColor("color")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2,bid_regexp,bid_string_es6]);
			if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)||lang.isInside(bid_regexp)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
			//regexp-specific rules
			if(lang.isInside(bid_regexp)){
				lang.Enable(bid_regexp_charset);
			}else{
				lang.Disable(bid_regexp_charset);
				lang.DisableToken(tok_regexp_escape);
				lang.DisableToken(tok_regexp_escape1);
				lang.DisableToken(tok_regexp_escape2);
				lang.DisableToken(tok_regexp_end);
			}
			if(lang.isInside(bid_regexp_charset)){
				lang.DisableToken(tok_regexp_end);
			}
			//`${}`-specific rules
			if(lang.isInside(bid_string_es6)){
				lang.Enable(bid_string_param);
			}else{
				lang.Disable(bid_string_param);
				//lang.DisableToken(tok_es6_string_param_left);
			}
			//enable the works-everywhere tokens
			lang.EnableToken(tok_es6_string_param_left);
			lang.EnableToken(tok_sqaure_bracket0);
			lang.EnableToken(tok_sqaure_bracket1);
			lang.EnableToken(tok_curly_bracket1);
		});
	}
});

Language.Register({
	name:'HTML',parser:"text",
	extensions:['htm','html'],
	file_icon_color:0xff444444,
	file_icon:'マ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_tag=lang.DefineDelimiter("key","<",">");
		var bid_script=lang.ColoredDelimiter("key","<script","</script>","color_symbol2");
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_js_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
		var bid_js_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_js_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		lang.m_owner.GetCommentStrings=function(mask){
			if(mask&(1<<bid_script)){
				//in script
				//if(mask&(1<<bid_string)){
				//	return {line_comment:"//",paired_comment:['",',',"']}
				//}
				//if(mask&(1<<bid_string2)){
				//	return {line_comment:"//",paired_comment:["',",",'"]}
				//}
				return {line_comment:"//",paired_comment:["/*","*/"]}
			}else{
				//in HTML
				return {paired_comment:["<!--","-->"]}
			}
		}
		//lang.m_owner.line_comment=undefined;
		//lang.m_owner.paired_comment=["<!--","-->"];
		lang.DefineToken("&amp;")
		lang.DefineToken("&apos;")
		lang.DefineToken('&quot;')
		lang.DefineToken('&lt;')
		lang.DefineToken('&gt;')
		lang.DefineToken('\\/')
		var kwset=lang.DefineKeywordSet("color_symbol",['<','/']);
		kwset.DefineKeywords("color_keyword",["DOCTYPE","a","abbr","acronym","address","applet","area","article","aside","audio","b","base","basefont","bdi","bdo","big","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","dir","div","dl","dt","em","embed","fieldset","figcaption","figure","font","footer","form","frame","frameset","h1","head","header","hr","html","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","menu","menuitem","meta","meter","nav","noframes","noscript","object","ol","optgroup","option","output","p","param","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","style","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","tt","u","ul","var","video","wbr","h1","h2","h3","h4","h5","h6"])
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol2");
		kwset.DefineKeywords("color_keyword",[
			'script',
			'break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super','window','document'])
		kwset.DefineKeywords("color_type",['typeof','var','let','void','boolean','byte','int','short','char','double','long','float'])
		kwset.DefineWordColor("color2")
		kwset.DefineWordType("color_number","0-9")
		lang.SetKeyDeclsBaseColor("color2")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_tag,bid_script]);
			if(lang.isInside(bid_script)){
				lang.SetExclusive([bid_js_comment,bid_js_comment2,bid_string,bid_string2]);
				if(lang.isInside(bid_js_comment)||lang.isInside(bid_js_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
					lang.Disable(bid_js_bracket);
				}else{
					lang.Enable(bid_js_bracket);
				}
			}else if(lang.isInside(bid_tag)){
				//we're in tags, enable strings but disable the JS stuff
				lang.Disable(bid_js_bracket);
				lang.Disable(bid_js_comment);
				lang.Disable(bid_js_comment2);
				lang.Enable(bid_string);
				lang.Enable(bid_string2);
			}else{
				lang.Disable(bid_js_bracket);
				lang.Disable(bid_js_comment);
				lang.Disable(bid_js_comment2);
				lang.Disable(bid_string);
				lang.Disable(bid_string2);
			}
		});
	}
});

Language.Register({
	name:'CSS',parser:"text",
	extensions:['css'],
	file_icon_color:0xff444444,
	file_icon:'プ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
		var bid_value=lang.DefineDelimiter("key",":",";");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		lang.DefineToken("\\\\")
		lang.DefineToken("\\'")
		lang.DefineToken('\\"')
		lang.DefineToken('\\\n')
		lang.m_non_default_word_chars="-";
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		kwset.DefineKeywords("color_type",["color","opacity","background","background-attachment","background-blend-mode", "background-color","background-image","background-position","background-repeat","background-clip","background-origin","background-size","border","border-bottom","border-bottom-color", "border-bottom-left-radius","border-bottom-right-radius","border-bottom-style","border-bottom-width","border-color","border-image","border-image-outset","border-image-repeat","border-image-slice","border-image-source","border-image-width","border-left","border-left-color","border-left-style","border-left-width","border-radius","border-right","border-right-color","border-right-style","border-right-width","border-style","border-top","border-top-color","border-top-left-radius","border-top-right-radius","border-top-style","border-top-width","border-width","box-decoration-break","box-shadow","bottom","clear","clip","display","float","height","left","margin","margin-bottom","margin-left","margin-right","margin-top","max-height","max-width","min-height","min-width","overflow","overflow-x","overflow-y","padding","padding-bottom","padding-left","padding-right","padding-top","position","right","top","visibility","width","vertical-align","z-index","align-content","align-items","align-self","flex","flex-basis","flex-direction","flex-flow","flex-grow","flex-shrink","flex-wrap","justify-content","order","hanging-punctuation","hyphens","letter-spacing","line-break","line-height","overflow-wrap","tab-size","text-align","text-align-last","text-combine-upright","text-indent","text-justify","text-transform","white-space","word-break","word-spacing","word-wrap","text-decoration","text-decoration-color","text-decoration-line","text-decoration-style","text-shadow","text-underline-position","@font-face","@font-feature-values","font","font-family","font-feature-settings","font-kerning","font-language-override","font-size","font-size-adjust","font-stretch","font-style","font-synthesis","font-variant","font-variant-alternates","font-variant-caps","font-variant-east-asian","font-variant-ligatures","font-variant-numeric","font-variant-position","font-weight","direction","text-orientation","text-combine-upright","unicode-bidi","border-collapse","border-spacing","caption-side","empty-cells","table-layout","counter-increment","counter-reset","list-style","list-style-image","list-style-position","list-style-type","@keyframes","animation","animation-delay","animation-direction","animation-duration","animation-fill-mode","animation-iteration-count","animation-name","animation-play-state","animation-timing-function","backface-visibility","perspective","perspective-origin","transform","transform-origin","transform-style","transition","transition-property","transition-duration","transition-timing-function","transition-delay","box-sizing","content","cursor","ime-mode","nav-down","nav-index","nav-left","nav-right","nav-up","outline","outline-color","outline-offset","outline-style","outline-width","resize","text-overflow","break-after","break-before","break-inside","column-count","column-fill","column-gap","column-rule","column-rule-color","column-rule-style","column-rule-width","column-span","column-width","columns","widows","orphans","page-break-after","page-break-before","page-break-inside","marks","quotes","filter","image-orientation","image-rendering","image-resolution","object-fit","object-position","mark","mark-after","mark-before","phonemes","rest","rest-after","rest-before","voice-balance","voice-duration","voice-pitch","voice-pitch-range","voice-rate","voice-stress","voice-volume","marquee-direction","marquee-play-count","marquee-speed","marquee-style"])
		kwset.DefineWordType("color_number","0-9")
		return (function(lang){
			lang.Enable(bid_comment)
			if(lang.isInside(bid_comment)){
				lang.Disable(bid_bracket)
				lang.Disable(bid_value)
			}else{
				lang.Enable(bid_value)
				if(lang.isInside(bid_value)){
					lang.SetExclusive([bid_string,bid_string2])
					if(lang.isInside(bid_string)||lang.isInside(bid_string2)){
						lang.Disable(bid_bracket)
					}else{
						lang.Enable(bid_bracket)
					}
				}else{
					lang.Enable(bid_bracket)
				}
			}
		})
	}
});


Language.Register({
	name:'XML',parser:"text",
	extensions:['xml','vcproj','vcxproj','sproj','sln','svg','mobileprovision'],
	ignore_indentation:1,
	file_icon_color:0xff444444,
	file_icon:'マ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var tok_left_bracket=lang.DefineToken('<')//short tokens must come first
		lang.DefineToken('>')//short tokens must come first
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_cdata=lang.ColoredDelimiter("key","<![CDATA[","]]>","color_symbol2");
		var bid_header=lang.ColoredDelimiter("key","<?","?>","color_meta");
		var bid_content=lang.DefineDelimiter("key",[">","/>"],["<",'</',"<!--","<![CDATA[","<?"]);
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['<'],['</','/>']);
		lang.DefineToken("&amp;")
		lang.DefineToken("&apos;")
		lang.DefineToken('&quot;')
		lang.DefineToken('&lt;')
		lang.DefineToken('&gt;')
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol",['<','/']);
		kwset.DefineWordColor("color_type")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_cdata,bid_header,bid_string,bid_content,bid_string2]);
			if(lang.isInside(bid_content)||lang.m_inside_mask==0){
				lang.Enable(bid_comment)
				lang.Enable(bid_cdata)
				lang.Enable(bid_header)
				lang.EnableToken("<!--")
				lang.EnableToken("<![CDATA[")
				lang.EnableToken("<?")
			}
			if(lang.isInside(bid_comment)||lang.isInside(bid_cdata)||lang.isInside(bid_header)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
				lang.EnableToken(tok_left_bracket)
			}
		});
	}
});

var f_shell_like=function(lang,keywords){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","#","\n","color_comment");
	var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
	lang.DefineToken('\\\n')
	var kwset=lang.DefineKeywordSet("color_symbol");
	for(var k in keywords){
		kwset.DefineKeywords("color_"+k,keywords[k])
	}
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	return (function(lang){
		lang.Enable(bid_comment)
		if(lang.isInside(bid_comment)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
}

Language.Register({
	name:'RenderMan RIB',parser:"none",
	extensions:['rib'],
	file_icon_color:0xff444444,
	file_icon:'も',
	rules:function(lang){
		return f_shell_like(lang,{
			'keyword':['RiArchiveRecord','RiAreaLightSource','RiAtmosphere','RiAttribute','RiAttributeBegin','RiAttributeEnd','RiBasis','RiBegin','RiBlobby','RiBound','RiClipping','RiClippingPlane','RiColor','RiColorSamples','RiConcatTransform','RiCone','RiContext','RiCoordinateSystem','RiCoordSysTransform','RiCropWindow','RiCurves','RiCylinder','RiDeclare','RiDepthOfField','RiDetail','RiDetailRange','RiDisk','RiDisplacement','RiDisplay','RiEnd','RiErrorHandler','RiExposure','RiExterior','RiFormat','RiFrameAspectRatio','RiFrameBegin','RiFrameEnd','RiGeneralPolygon','RiGeometricApproximation','RiGeometry','RiGetContext','RiHider','RiHyperboloid','RiIdentity','RiIlluminate','RiImager','RiInterior','RiLightSource','RiMakeCubeFaceEnvironment','RiMakeLatLongEnvironment','RiMakeShadow','RiMakeTexture','RiMatte','RiMotionBegin','RiMotionEnd','RiNuPatch','RiObjectBegin','RiObjectEnd','RiObjectInstance','RiOpacity','RiOption','RiOrientation','RiParaboloid','RiPatch','RiPatchMesh','RiPerspective','RiPixelFilter','RiPixelSamples','RiPixelVariance','RiPoints','RiPointsGeneralPolygons','RiPointsPolygons','RiPolygon','RiProcedural','RiProjection','RiQuantize','RiReadArchive','RiRelativeDetail','RiReverseOrientation','RiRotate','RiScale','RiScreenWindow','RiShadingInterpolation','RiShadingRate','RiShutter','RiSides','RiSkew','RiSolidBegin','RiSolidEnd','RiSphere','RiSubdivisionMesh','RiSurface','RiTextureCoordinates','RiTorus','RiTransform','RiTransformBegin','RiTransformEnd','RiTransformPoints','RiTranslate','RiTrimCurve','RiWorldBegin','RiWorldEnd'],
		})
	}
});
Language.Register({
	name:'WaveFront OBJ',parser:"none",
	extensions:['obj'],
	file_icon_color:0xff444444,
	file_icon:'も',
	rules:function(lang){
		return f_shell_like(lang,{
			'keyword':['usemtl','mtllib','g','s','o'],
			'type':['v','vn','vt','f'],
		})
	}
});
Language.Register({
	name:'WaveFront MTL',parser:"none",
	extensions:['mtl'],
	file_icon_color:0xff444444,
	file_icon:'も',
	rules:function(lang){
		return f_shell_like(lang,{
			'keyword':['newmtl'],
			'type':['Ka','Kd','Ks','illum','Ns','map_Kd','map_bump','bump','map_opacity','map_d','refl','map_kS','map_kA','map_Ns'],
		})
	}
});

Language.Register({
	name:'Unix Shell Script',parser:"none",
	extensions:['sh'],
	has_backquote_string:1,
	shell_script_type:"unix",
	file_icon_color:0xff444444,
	file_icon:'プ',
	rules:function(lang){
		return f_shell_like(lang,{
			'keyword':['if','fi','else','function','for','while','do','done'],
		})
	}
});

Language.Register({
	name:'Windows BAT',parser:"none",
	extensions:['bat','cmd'],
	shell_script_type:"windows",
	file_icon_color:0xff444444,
	file_icon:'プ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","rem ","\n","color_comment");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var kwset=lang.DefineKeywordSet("color_symbol");
		var keywords={
			'keyword':['if','exists','not','goto','for','do'],
			'type':['ASSOC','BREAK','CALL','CD','CHDIR','CHCP','CLS','COLOR','COPY','DATE','DEL, ERASE','DIR','ECHO','ELSE','ENDLOCAL','EXIT','FTYPE','MD','MKDIR','MOVE','PATH','PAUSE','POPD','PROMPT','PUSHD','RD','RMDIR','REM','REN','RENAME','SET','SETLOCAL','SHIFT','START','TIME','TITLE','TYPE','VER','VERIFY','VOL']
		}
		for(var k in keywords){
			var words=[];
			var words0=keywords[k];
			for(var i=0;i<words0.length;i++){
				words.push(words0[i].toLowerCase())
				words.push(words0[i].toUpperCase())
			}
			kwset.DefineKeywords("color_"+k,words)
		}
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		return (function(lang){
			lang.Enable(bid_comment)
			if(lang.isInside(bid_comment)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

var f_tex_like=function(lang){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","%","\n","color_comment");
	var bid_math=lang.ColoredDelimiter("key","$","$","color_string");
	var bid_bracket=lang.DefineDelimiter("nested",['\\begin','{'],['}','\\end']);
	//assert(bid_math==2)
	lang.DefineToken('\\{')
	lang.DefineToken("\\}")
	lang.DefineToken("\\\\")
	lang.DefineToken("\\\n")
	lang.DefineToken("\\$")
	lang.DefineToken("\\%")
	/////////////
	var kwset=lang.DefineKeywordSet("color_symbol","\\");
	kwset.DefineWordColor("color_keyword")
	kwset.DefineKeywords("color_type",['begin','end','addcontentsline','addtocontents','addtocounter','address','addtolength','addvspace','alph','appendix','arabic','author','backslash','baselineskip','baselinestretch','bf','bibitem','bigskipamount','bigskip','boldmath','boldsymbol','cal','caption','cdots','centering','chapter','circle','cite','cleardoublepage','clearpage','cline','closing','color','copyright','dashbox','date','ddots','documentclass','dotfill','em','emph','ensuremath','epigraph','euro','fbox','flushbottom','fnsymbol','footnote','footnotemark','footnotesize','footnotetext','frac','frame','framebox','frenchspacing','hfill','hline','href','hrulefill','hspace','huge','Huge','hyphenation','include','includegraphics','includeonly','indent','input','it','item','kill','label','large','Large','LARGE','LaTeX','LaTeXe','ldots','lefteqn','line','linebreak','linethickness','linewidth','listoffigures','listoftables','location','makebox','maketitle','markboth','mathcal','mathop','mbox','medskip','multicolumn','multiput','newcommand','newcolumntype','newcounter','newenvironment','newfont','newlength','newline','newpage','newsavebox','newtheorem','nocite','noindent','nolinebreak','nonfrenchspacing','normalsize','nopagebreak','not','onecolumn','opening','oval','overbrace','overline','pagebreak','pagenumbering','pageref','pagestyle','par','paragraph','parbox','parindent','parskip','part','protect','providecommand','put','raggedbottom','raggedleft','raggedright','raisebox','ref','renewcommand','rm','roman','rule','savebox','sbox','sc','scriptsize','section','setcounter','setlength','settowidth','sf','shortstack','signature','sl','slash','small','smallskip','sout','space','sqrt','stackrel','stepcounter','subparagraph','subsection','subsubsection','tableofcontents','telephone','TeX','textbf','textcolor','textit','textmd','textnormal','textrm','textsc','textsf','textsl','texttt','textup','textwidth','textheight','thanks','thispagestyle','tiny','title','today','tt','twocolumn','typeout','typein','uline','underbrace','underline','unitlength','usebox','usecounter','uwave','value','vbox','vcenter','vdots','vector','verb','vfill','vline','vphantom','vspace','usepackage','documentclass'])
	kwset.DefineKeywords("color_meta",['left','right'])
	kwset=lang.DefineKeywordSet("color_string","\\");
	kwset.DefineWordColor("color_keyword")
	kwset.DefineKeywords("color_type",['begin','end','addcontentsline','addtocontents','addtocounter','address','addtolength','addvspace','alph','appendix','arabic','author','backslash','baselineskip','baselinestretch','bf','bibitem','bigskipamount','bigskip','boldmath','boldsymbol','cal','caption','cdots','centering','chapter','circle','cite','cleardoublepage','clearpage','cline','closing','color','copyright','dashbox','date','ddots','documentclass','dotfill','em','emph','ensuremath','epigraph','euro','fbox','flushbottom','fnsymbol','footnote','footnotemark','footnotesize','footnotetext','frac','frame','framebox','frenchspacing','hfill','hline','href','hrulefill','hspace','huge','Huge','hyphenation','include','includegraphics','includeonly','indent','input','it','item','kill','label','large','Large','LARGE','LaTeX','LaTeXe','ldots','lefteqn','line','linebreak','linethickness','linewidth','listoffigures','listoftables','location','makebox','maketitle','markboth','mathcal','mathop','mbox','medskip','multicolumn','multiput','newcommand','newcolumntype','newcounter','newenvironment','newfont','newlength','newline','newpage','newsavebox','newtheorem','nocite','noindent','nolinebreak','nonfrenchspacing','normalsize','nopagebreak','not','onecolumn','opening','oval','overbrace','overline','pagebreak','pagenumbering','pageref','pagestyle','par','paragraph','parbox','parindent','parskip','part','protect','providecommand','put','raggedbottom','raggedleft','raggedright','raisebox','ref','renewcommand','rm','roman','rule','savebox','sbox','sc','scriptsize','section','setcounter','setlength','settowidth','sf','shortstack','signature','sl','slash','small','smallskip','sout','space','sqrt','stackrel','stepcounter','subparagraph','subsection','subsubsection','tableofcontents','telephone','TeX','textbf','textcolor','textit','textmd','textnormal','textrm','textsc','textsf','textsl','texttt','textup','textwidth','textheight','thanks','thispagestyle','tiny','title','today','tt','twocolumn','typeout','typein','uline','underbrace','underline','unitlength','usebox','usecounter','uwave','value','vbox','vcenter','vdots','vector','verb','vfill','vline','vphantom','vspace','usepackage','documentclass'])
	kwset.DefineKeywords("color_meta",['left','right'])
	kwset=lang.DefineKeywordSet("color_symbol");
	kwset.DefineWordColor("color")
	kwset.DefineWordType("color_number","0-9")
	lang.SetSpellCheckedColor("color")
	//lang.m_non_default_word_chars="_";
	return (function(lang){
		lang.SetExclusive([bid_comment,bid_math])
		if(lang.isInside(bid_comment)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
	});
};
Language.Register({
	name:'TeX/LaTeX',extensions:['tex','cls'],
	curly_bracket_is_not_special:1,is_tex_like:1,
	enable_dictionary:1,
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xffb4771f,
	file_icon:'テ',
	rules:f_tex_like
});

Language.Register({
	name:'TeX bibliography',extensions:['bib'],
	curly_bracket_is_not_special:1,is_tex_like:1,
	enable_dictionary:1,
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xff2ca033,
	file_icon:'テ',
	rules:f_tex_like
});

Language.Register({
	name_sort_hack:" Markdown",name:'Markdown',extensions:['md','markdown'],
	curly_bracket_is_not_special:1,
	enable_dictionary:1,
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xff444444,
	file_icon:'文',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var tok_newline=lang.DefineToken("\n");
		var bid_title=lang.ColoredDelimiter("key",lang.DefineToken("\n#",1),"\n","color_type");
		var bid_code2=lang.ColoredDelimiter("key",lang.DefineToken("\n\t",1),"\n","color_string");
		var bid_code=lang.ColoredDelimiter("key","`","`","color_string");
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		/////////////
		lang.SetSpellCheckedColor("color")
		return (function(lang){
			lang.SetExclusive([bid_title,bid_code,bid_code2])
			lang.EnableToken(tok_newline)
		});
	}
});

Language.Register({
	name:'Matlab',parser:"none",
	extensions:['m'],
	file_icon_color:0xffb4771f,
	file_icon:'プ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","%","\n","color_comment");
		var bid_string=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var kwset=lang.DefineKeywordSet("color_symbol");
		lang.DefineToken('\\\n')
		lang.DefineToken("\\'")
		lang.DefineToken(".'")
		kwset.DefineKeywords("color_type",['abs','accumarray','acos','acosd','acosh','acot','acotd','acoth','acsc','acscd','acsch','actxcontrol','actxcontrollist','actxcontrolselect','actxGetRunningServer','actxserver','addCause','addevent','addframe','addlistener','addOptional','addParamValue','addpath','addpref','addprop','addproperty','addRequired','addsample','addsampletocollection','addtodate','addts','airy','align','alim','all','allchild','alpha','alphamap','amd','ancestor','and','angle','ans','any','append','area','arrayfun','ascii','asec','asecd','asech','asin','asind','asinh','assert','assignin','atan','atan2','atand','atanh','audiodevinfo','audioplayer','audiorecorder','aufinfo','auread','auwrite','avifile','aviinfo','aviread','axes','axis','balance','bar','bar3','bar3h','barh','baryToCart','base2dec','beep','BeginInvoke','bench','besselh','besseli','besselj','besselk','bessely','beta','betainc','betaincinv','betaln','bicg','bicgstab','bicgstabl','bin2dec','binary','bitand','bitcmp','bitget','bitmax','bitnot','bitor','bitset','bitshift','bitxor','blanks','blkdiag','box','break','brighten','brush','bsxfun','builddocsearchdb','builtin','bvp4c','bvp5c','bvpget','bvpinit','bvpset','bvpxtend','calendar','calllib','callSoapService','camdolly','cameratoolbar','camlight','camlookat','camorbit','campan','campos','camproj','camroll','camtarget','camup','camva','camzoom','cart2pol','cart2sph','cartToBary','case','cast','cat','catch','caxis','cd','cdf2rdf','cdfepoch','cdfinfo','cdflib','cdfread','cdfwrite','ceil','cell','cell2mat','cell2struct','celldisp','cellfun','cellplot','cellstr','cgs','char','checkcode','checkin','checkout','chol','cholinc','cholupdate','circshift','circumcenters','cla','clabel','class','classdef','clc','clear','clear','clearvars','clf','clipboard','clock','close','close','closereq','cmopts','cmpermute','cmunique','colamd','colorbar','colordef','colormap','colormapeditor','ColorSpec','colperm','Combine','comet','comet3','commandhistory','commandwindow','compan','compass','complex','computer','computeStrip','computeTile','cond','condeig','condest','coneplot','conj','continue','contour','contour3','contourc','contourf','contourslice','contrast','conv','conv2','convexHull','convhull','convhulln','convn','copy','copyfile','copyobj','corrcoef','cos','cosd','cosh','cot','cotd','coth','cov','cplxpair','cputime','createClassFromWsdl','createCopy','createSoapMessage','cross','csc','cscd','csch','csvread','csvwrite','ctranspose','cumprod','cumsum','cumtrapz','curl','currentDirectory','customverctrl','cylinder','daqread','daspect','datacursormode','datatipinfo','date','datenum','datestr','datetick','datevec','dbclear','dbcont','dbdown','dblquad','dbmex','dbquit','dbstack','dbstatus','dbstep','dbstop','dbtype','dbup','dde23','ddeget','ddesd','ddeset','deal','deblank','dec2base','dec2bin','dec2hex','decic','deconv','del2','delaunay','delaunay3','delaunayn','DelaunayTri','delete','delete','delete','delete','delete','deleteproperty','delevent','delsample','delsamplefromcollection','demo','depdir','depfun','det','detrend','deval','diag','dialog','diary','diff','diffuse','dir','disp','disp','disp','disp','disp','display','dither','divergence','dlmread','dlmwrite','dmperm','doc','docsearch','dos','dot','double','dragrect','drawnow','dsearch','dsearchn','dynamicprops','echo','echodemo','edgeAttachments','edges','edit','eig','eigs','ellipj','ellipke','ellipsoid','empty','enableNETfromNetworkDrive','enableservice','end','EndInvoke','enumeration','eomday','eps','eq','eq','erf','erfc','erfcinv','erfcx','erfinv','error','errorbar','errordlg','etime','etree','etreeplot','eval','evalc','evalin','eventlisteners','events','events','Execute','exifread','exist','exit','exp','expint','expm','expm1','export2wsdlg','eye','ezcontour','ezcontourf','ezmesh','ezmeshc','ezplot','ezplot3','ezpolar','ezsurf','ezsurfc','faceNormals','factor','factorial','false','fclose','fclose','feather','featureEdges','feof','ferror','feval','Feval','fft','fft2','fftn','fftshift','fftw','fgetl','fgetl','fgets','fgets','fieldnames','figure','figurepalette','fileattrib','filebrowser','filemarker','fileparts','fileread','filesep','fill','fill3','filter','filter2','find','findall','findfigs','findobj','findobj','findprop','findstr','finish','fitsdisp','fitsinfo','fitsread','fitswrite','fix','flipdim','fliplr','flipud','floor','flow','fminbnd','fminsearch','fopen','fopen','format','fplot','fprintf','fprintf','frame2im','fread','fread','freeBoundary','freqspace','frewind','fscanf','fscanf','fseek','ftell','FTP','full','fullfile','func2str','function','function_handle','functions','funm','fwrite','fwrite','fzero','gallery','gamma','gammainc','gammaincinv','gammaln','gca','gcbf','gcbo','gcd','gcf','gco','ge','genpath','genvarname','get','get','get','get','get','get','get','get','getabstime','getabstime','getappdata','getaudiodata','GetCharArray','getdatasamples','getdatasamplesize','getDefaultScalarElement','getdisp','getenv','getfield','getFileFormats','getframe','GetFullMatrix','getinterpmethod','getpixelposition','getpref','getProfiles','getqualitydesc','getReport','getsamples','getsampleusingtime','getsampleusingtime','getTag','getTagNames','gettimeseriesnames','gettsafteratevent','gettsafterevent','gettsatevent','gettsbeforeatevent','gettsbeforeevent','gettsbetweenevents','GetVariable','getVersion','GetWorkspaceData','ginput','global','gmres','gplot','grabcode','gradient','graymon','grid','griddata','griddata3','griddatan','griddedInterpolant','gsvd','gt','gtext','guidata','guide','guihandles','gunzip','gzip','h5create','h5disp','h5info','h5read','h5readatt','h5write','h5writeatt','hadamard','handle','hankel','hdf','hdf5','hdf5info','hdf5read','hdf5write','hdfinfo','hdfread','hdftool','help','helpbrowser','helpdesk','helpdlg','helpwin','hess','hex2dec','hex2num','hgexport','hggroup','hgload','hgsave','hgsetget','hgtransform','hidden','hilb','hist','histc','hold','home','horzcat','horzcat','hostid','hsv2rgb','hypot','i','ichol','idealfilter','idivide','ifft','ifft2','ifftn','ifftshift','ilu','im2frame','im2java','imag','image','imagesc','imapprox','imfinfo','imformats','import','importdata','imread','imwrite','incenters','ind2rgb','ind2sub','Inf','inferiorto','info','inline','inmem','inOutStatus','inpolygon','input','inputdlg','inputname','inputParser','inspect','instrcallback','instrfind','instrfindall','int16','int2str','int32','int64','int8','integral','integral2','integral3','interfaces','interp1','interp1q','interp2','interp3','interpft','interpn','interpstreamspeed','intersect','intmax','intmin','inv','invhilb','invoke','ipermute','iqr','is*','isa','isappdata','iscell','iscellstr','ischar','iscolumn','iscom','isdir','isEdge','isempty','isempty','isequal','isequal','isequaln','isequalwithequalnans','isevent','isfield','isfinite','isfloat','isglobal','ishandle','ishghandle','ishold','isinf','isinteger','isinterface','isjava','isKey','iskeyword','isletter','islogical','ismac','ismatrix','ismember','ismethod','ismethod','isnan','isnumeric','isobject','isocaps','isocolors','isonormals','isosurface','ispc','isPlatformSupported','ispref','isprime','isprop','isprop','isreal','isrow','isscalar','issorted','isspace','issparse','isstr','isstrprop','isstruct','isstudent','isTiled','isunix','isvalid','isvalid','isvalid','isvarname','isvector','j','javaaddpath','javaArray','javachk','javaclasspath','javaMethod','javaMethodEDT','javaObject','javaObjectEDT','javarmpath','keyboard','keys','kron','last','lastDirectory','lasterr','lasterror','lastwarn','lcm','ldivide','ldl','le','legend','legendre','length','length','length','libfunctions','libfunctionsview','libisloaded','libpointer','libstruct','license','light','lightangle','lighting','lin2mu','line','LineSpec','linkaxes','linkdata','linkprop','linsolve','linspace','listdlg','listfonts','load','load','load','loadlibrary','loadobj','log','log10','log1p','log2','logical','loglog','logm','logspace','lookfor','lower','ls','lscov','lsqnonneg','lsqr','lt','lu','luinc','magic','makehgtform','mat2cell','mat2str','material','matfile','matlab','matlab','max','MaximizeCommandWindow','maxNumCompThreads','mean','median','memmapfile','memory','menu','mesh','meshc','meshgrid','meshz','methods','methodsview','mex','MException','mexext','mfilename','mget','min','MinimizeCommandWindow','minres','minus','mislocked','mkdir','mkpp','mldivide','mrdivide','mlint','mlintrpt','mlock','mmfileinfo','mmreader','mod','mode','more','move','movefile','movegui','movie','movie2avi','mpower','mput','msgbox','mtimes','mu2lin','multibandread','multibandwrite','munlock','namelengthmax','NaN','nargchk','nargin','narginchk','nargout','nargoutchk','native2unicode','nccreate','ncdisp','nchoosek','ncinfo','ncread','ncreadatt','ncwrite','ncwriteatt','ncwriteschema','ndgrid','ndims','ne','ne','nearestNeighbor','neighbors','NET','netcdf','newplot','nextDirectory','nextpow2','nnz','noanimate','nonzeros','norm','normest','not','notebook','notify','now','nthroot','null','num2cell','num2hex','num2str','numberOfStrips','numberOfTiles','numel','nzmax','ode113','ode15i','ode15s','ode23','ode23s','ode23t','ode23tb','ode45','odeget','odeset','odextend','onCleanup','ones','open','openfig','opengl','openvar','optimget','optimset','or','ordeig','orderfields','ordqz','ordschur','orient','orth','otherwise','pack','padecoef','pagesetupdlg','pan','pareto','parfor','parse','parseSoapResponse','pascal','patch','path','path2rc','pathsep','pathtool','pause','pbaspect','pcg','pchip','pcode','pcolor','pdepe','pdeval','peaks','perl','perms','permute','persistent','pi','pie','pie3','pinv','planerot','play','playblocking','playshow','plot','plot3','plotbrowser','plotedit','plotmatrix','plottools','plotyy','plus','pointLocation','pol2cart','polar','poly','polyarea','polyder','polyeig','polyfit','polyint','polyval','polyvalm','pow2','power','ppval','prefdir','preferences','primes','print','printdlg','printopt','printpreview','prod','profile','profsave','propedit','propedit','properties','propertyeditor','psi','publish','PutCharArray','PutFullMatrix','PutWorkspaceData','pwd','qmr','qr','qrdelete','qrinsert','qrupdate','quad','quad2d','quadgk','quadl','quadv','questdlg','quit','Quit','quiver','quiver3','qz','rand','rand','randi','randi','randn','randn','randperm','randperm','RandStream','rank','rat','rats','rbbox','rcond','rdivide','read','readasync','readEncodedStrip','readEncodedTile','real','reallog','realmax','realmin','realpow','realsqrt','record','recordblocking','rectangle','rectint','recycle','reducepatch','reducevolume','refresh','refreshdata','regexp','regexpi','regexprep','regexptranslate','registerevent','rehash','relationaloperators','release','rem','Remove','remove','RemoveAll','removets','rename','repmat','resample','resample','reset','reset','reshape','residue','restoredefaultpath','rethrow','return','rewriteDirectory','rgb2hsv','rgb2ind','rgbplot','ribbon','rmappdata','rmdir','rmfield','rmpath','rmpref','rng','roots','rose','rosser','rot90','rotate','rotate3d','round','rref','rsf2csf','run','save','save','save','saveas','saveobj','savepath','scatter','scatter3','schur','script','sec','secd','sech','selectmoveresize','semilogx','semilogy','sendmail','serial','serialbreak','set','set','set','set','set','set','set','setabstime','setabstime','setappdata','setdiff','setDirectory','setdisp','setenv','setfield','setinterpmethod','setpixelposition','setpref','setstr','setSubDirectory','setTag','settimeseriesnames','setuniformtime','setxor','shading','shg','shiftdim','showplottool','shrinkfaces','sign','sin','sind','single','sinh','size','size','size','slice','smooth3','snapnow','sort','sortrows','sound','soundsc','spalloc','sparse','spaugment','spconvert','spdiags','specular','speye','spfun','sph2cart','sphere','spinmap','spline','spones','spparms','sprand','sprandn','sprandsym','sprank','sprintf','spy','sqrt','sqrtm','squeeze','ss2tf','sscanf','stairs','start','startat','startup','std','stem','stem3','stop','stopasync','str2double','str2func','str2mat','str2num','strcat','strcmp','strcmpi','stream2','stream3','streamline','streamparticles','streamribbon','streamslice','streamtube','strfind','strings','strjust','strmatch','strncmp','strncmpi','strread','strrep','strtok','strtrim','struct','struct2cell','structfun','strvcat','sub2ind','subplot','subsasgn','subsindex','subspace','subsref','substruct','subvolume','sum','superclasses','superiorto','support','surf','surf2patch','surface','surfc','surfl','surfnorm','svd','svds','swapbytes','symamd','symbfact','symmlq','symrcm','symvar','synchronize','syntax','system','tan','tand','tanh','tar','tempdir','tempname','tetramesh','texlabel','text','textread','textscan','textwrap','tfqmr','throwAsCaller','tic','Tiff','timer','timerfind','timerfindall','times','timeseries','title','toc','todatenum','toeplitz','toolboxdir','trace','transpose','trapz','treelayout','treeplot','tril','trimesh','triplequad','triplot','TriRep','TriScatteredInterp','trisurf','triu','true','tscollection','tsearch','tsearchn','tstool','type','typecast','uibuttongroup','uicontextmenu','uicontrol','uigetdir','uigetfile','uigetpref','uiimport','uimenu','uint16','uint32','uint64','uint8','uiopen','uipanel','uipushtool','uiputfile','uiresume','uisave','uisetcolor','uisetfont','uisetpref','uistack','uitable','uitoggletool','uitoolbar','uiwait','uminus','undocheckout','unicode2native','union','unique','unix','unloadlibrary','unmesh','unmkpp','unregisterallevents','unregisterevent','untar','unwrap','unzip','uplus','upper','urlread','urlwrite','usejava','userpath','validateattributes','validatestring','values','vander','var','varargin','varargout','vectorize','ver','verctrl','verLessThan','version','vertcat','vertcat','vertexAttachments','VideoReader','VideoWriter','view','viewmtx','visdiff','volumebounds','voronoi','voronoiDiagram','voronoin','wait','waitbar','waitfor','waitforbuttonpress','warndlg','warning','waterfall','wavfinfo','wavplay','wavread','wavrecord','wavwrite','web','weekday','what','whatsnew','which','whitebg','who','whos','wilkinson','winopen','winqueryreg','wk1finfo','wk1read','wk1write','workspace','write','writeDirectory','writeEncodedStrip','writeEncodedTile','writeVideo','xlabel','xlim','xlsfinfo','xlsread','xlswrite','xmlread','xmlwrite','xor','xslt','ylabel','ylim','zeros','zip','zlabel','zlim','zoom'])
		kwset.DefineKeywords("color_keyword",['if','else','end','elseif','function','otherwise','switch','case','for','while','break','continue','try','catch','throw','rethrow','true','false'])
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		lang.SetKeyDeclsBaseColor("color")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_string])
			if(lang.isInside(bid_comment)||lang.isInside(bid_string)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

Language.Register({
	name:'Python',parser:"C",
	extensions:['py'],
	indent_as_parenthesis:1,
	curly_bracket_is_not_special:1,
	file_icon_color:0xffb4771f,
	file_icon:'プ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		var bid_comment=lang.ColoredDelimiter("key","#","\n","color_comment");
		var bid_string0=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_string1=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'''","'''","color_string");
		var bid_string3=lang.ColoredDelimiter("key",'"""','"""',"color_string");
		var bid_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		var kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineKeywords("color_type",['def','lambda','int'])
		kwset.DefineKeywords("color_keyword",['and','del','from','not','while','as','elif','global','or','with','assert','else','if','pass','yield','break','except','import','print','class','exec','in','raise','continue','finally','is','return','for','try','True','False'])
		kwset.DefineWordColor("color")
		kwset.DefineWordType("color_number","0-9")
		lang.SetKeyDeclsBaseColor("color")
		return (function(lang){
			lang.SetExclusive([bid_comment,bid_string0,bid_string1,bid_string2,bid_string3])
			if(lang.isInside(bid_comment)||lang.isInside(bid_string0)||lang.isInside(bid_string1)||lang.isInside(bid_string2)||lang.isInside(bid_string3)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
			}
		});
	}
});

/////////////////////////////////////////////
//compiler output parsers
//texify -q
UI.RegisterOutputParser('([^:]*):([0-9]+): (.+)',3,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	var message=matches[3]
	var err={
		file_name:name,
		category:"error",
		message:message,line0:linea-1,
	}
	//another plugin for error overlay
	return err
});

//our own search output
UI.RegisterOutputParser('(.*?):([0-9]+)[.][.]([0-9]+): (.*)',4,function(matches){
	var err={}
	var name=matches[1];
	var ccnt0=parseInt(matches[2]);
	var ccnt1=parseInt(matches[3]);
	var message=matches[4];
	var err={
		file_name:name,
		category:'match',
		message:message,
		ccnt0:ccnt0,
		ccnt1:ccnt1,
		is_quiet:1,
	}
	return err;
})

//unix cc
UI.RegisterOutputParser('(.*?):([0-9]+):(([0-9]+):)? ((error)|(warning): )?(.*)',8,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	var message=matches[8]
	var category=(matches[5]?matches[5].toLowerCase():"error")
	//for(var i=0;i<matches.length;i++){
	//	print(i,matches[i])
	//}
	var err={
		file_name:name,
		category:category,
		message:message,line0:linea-1
	}
	if(matches[4]){
		err.col0=parseInt(matches[4])-1
	}
	return err
});

//jc
UI.RegisterOutputParser('(.*?):([0-9]+),([0-9]+)-(([0-9]+),)?([0-9]+): (.*)\\(([^()]*)\\)',8,function(matches){
	var err={}
	var name=matches[1];
	var linea=parseInt(matches[2]);
	var cola=parseInt(matches[3]);
	var lineb=undefined;
	if(matches[4]){
		lineb=parseInt(matches[4]);
	}else{
		lineb=linea;
	}
	//print(err.lineb,' ',matches[4],' ',matches[5],' ',matches[6],'\n')
	var colb=undefined;
	if(matches[6]){
		colb=parseInt(matches[6]);
	}
	var message=matches[7]
	var category=matches[8]
	var err={
		file_name:name,
		category:category,
		message:message,
		line0:linea-1,col0:cola-1,
		line1:lineb-1,col1:colb-1,
	}
	if(lineb>=linea+1){
		err.line1=undefined;
		err.col1=undefined;
	}
	return err;
});

//vc
UI.RegisterOutputParser('[ \t]*([^ \t].*)[ \t]*\\(([0-9]+)\\)[ \t]*:?[ \t]*(fatal )?((error)|(warning))[ \t]+C[0-9][0-9][0-9][0-9][ \t]*:[ \t]*(.+)',7,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	var message=matches[7]
	var category=matches[4]
	var err={
		file_name:name,
		category:category,
		message:message,line0:linea-1,
	}
	return err
})

//python
UI.RegisterOutputParser('[ \t]*File[ \t]*"([^"]+)",[ \t]*line[ \t]*([0-9]+).*',2,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	var err={
		file_name:name,
		category:"error",
		message:"Python stack dump",line0:linea-1,
	}
	return err
});

//node.js
UI.RegisterOutputParser('[ \t]*at[ \t]*.*[ \t]*\\((.*):([0-9]+):([0-9]+)\\).*',3,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	//var cola=parseInt(matches[3])
	var err={
		file_name:name,
		category:"error",
		message:"node.js stack dump",
		line0:linea-1,
	}
	return err
});

UI.RegisterOutputParser('[ \t]*at[ \t]*(.*):([0-9]+):([0-9]+)',3,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	//var cola=parseInt(matches[3])
	var err={
		file_name:name,
		category:"error",
		message:"node.js stack dump",
		line0:linea-1,
	}
	return err
});

UI.RegisterOutputParser('[ \t]*at[ \t]*[^ ]* \\((.*):([0-9]+)\\)[ a-zA-Z]*',2,function(matches){
	var name=matches[1]
	var linea=parseInt(matches[2])
	//var cola=parseInt(matches[3])
	var err={
		file_name:name.indexOf('.')>=0?name:(name+'.js'),
		category:"error",
		message:"duktape stack dump",
		line0:linea-1,
	}
	return err
});

/////////////////////////////////////////////
//search engine hooks
var SearchEngineHook=function(items,ssearch, icon,stitle_template,url_template){
	var stitle=UI.Format(stitle_template,ssearch);
	var pssearch=stitle_template.indexOf('@1');
	items.push({
		icon:icon,
		title:stitle,
		hl_ranges:pssearch<0?[]:[pssearch,pssearch+ssearch.length],
		url:url_template.replace('文',encodeURIComponent(ssearch)),
	})
};

//default dictionaries
UI.RegisterHelpHook(function(items,ssearch){
	if(!ssearch){return;}
	var tab_frontmost=UI.GetFrontMostEditorTab();
	var fn=(tab_frontmost&&tab_frontmost.main_widget&&tab_frontmost.main_widget.file_name);
	var lang=(fn&&UI.ED_GetFileLanguage(fn));
	if(!lang){
		return;
	}
	if(lang.enable_dictionary){
		SearchEngineHook(items,'define '+ssearch,'写',UI._("Google “@1”"),"https://www.google.com/search?sourceid=navclient&q=文");
		SearchEngineHook(items,ssearch.toLowerCase(),'写',UI._("Wiktionary entry for “@1”"),UI._("https://en.wiktionary.org/wiki/文"));
	}
})

//language-specific sites
var g_node_modules={"assert":1,"buffer":1,"child_process":1,"cluster":1,"console":1,"constants":1,"crypto":1,"dgram":1,"dns":1,"domain":1,"events":1,"fs":1,"http":1,"https":1,"module":1,"net":1,"os":1,"path":1,"process":1,"punycode":1,"querystring":1,"readline":1,"repl":1,"stream":1,"string_decoder":1,"timers":1,"tls":1,"tty":1,"url":1,"util":1,"v8":1,"vm":1,"zlib":1};
UI.RegisterHelpHook(function(items,ssearch){
	if(!ssearch){return;}
	var tab_frontmost=UI.GetFrontMostEditorTab();
	var fn=(tab_frontmost&&tab_frontmost.main_widget&&tab_frontmost.main_widget.file_name);
	var lang=(fn&&UI.ED_GetFileLanguage(fn));
	if(!lang){return;}
	var sext=UI.GetFileNameExtension(fn).toLowerCase();
	if(lang.name=="C/C++/C#"){
		if(sext=='m'||sext=='mm'){
			SearchEngineHook(items,ssearch,'プ',UI._("“@1” for Apple developers"),"https://developer.apple.com/search/?q=文");
		}
		if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			SearchEngineHook(items,ssearch,'プ',UI._("“@1” on MSDN"),"https://social.msdn.microsoft.com/Search/en-US?query=文&pgArea=header&emptyWatermark=true&ac=4");
		}
	}
	if(lang.name=="Java"){
		SearchEngineHook(items,ssearch,'プ',UI._("Android class “@1”"),"http://developer.android.com/reference/classes.html#q=文");
	}
	if(lang.name=="Javascript"){
		if(g_node_modules[ssearch.toLowerCase()]){
			SearchEngineHook(items,ssearch.toLowerCase(),'プ',UI._('Node.js package “@1”'),"https://nodejs.org/api/文.html");
		}else{
			SearchEngineHook(items,ssearch.toLowerCase(),'プ',UI._('Node.js package “@1”'),"https://www.npmjs.com/search?q=文");
		}
	}
})


//general Googling - put it in the end
UI.RegisterHelpHook(function(items,ssearch){
	if(!ssearch){return;}
	SearchEngineHook(items,ssearch,'s',UI._("Google for “@1”"),"https://www.google.com/search?sourceid=navclient&q=文");
})

/////////////////////////////////////////////
//interpreters / notebook cell generators
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor||this.notebook_owner){return;}
	this.AddEventHandler('global_menu',function(){
		var desc=this.plugin_language_desc;
		//if(!desc.m_buildenv_by_name){return 1;}
		var obj_buildenv=undefined;
		var s_name_default=undefined;
		if(desc.m_buildenv_by_name){
			s_name_default=UI.GetDefaultBuildEnv(desc.name);
			obj_buildenv=desc.m_buildenv_by_name[this.m_compiler_name||s_name_default];
			if(!obj_buildenv&&this.m_compiler_name){
				this.m_compiler_name=undefined;
				obj_buildenv=desc.m_buildenv_by_name[this.m_compiler_name||s_name_default];
			}
		}
		var spath_repo=IO.NormalizeFileName(UI.GetNotebookProject(this.m_file_name));
		//console.log(UI.GetNotebookProject(this.m_file_name),spath_repo);
		var fn_to_build=IO.NormalizeFileName(this.m_file_name);
		if(fn_to_build.length>spath_repo.length&&fn_to_build.substr(0,spath_repo.length)==spath_repo){
			fn_to_build=fn_to_build.substr(spath_repo.length);
			if(fn_to_build[0]=='/'||fn_to_build[0]=='\\'){
				fn_to_build=fn_to_build.substr(1);
			}
		}
		//if(!obj_buildenv){return 1;}
		var menu_run=UI.BigMenu("&Run")
		var fgencell=function(is_project){
			var s_script=undefined;
			if(obj_buildenv){
				if(obj_buildenv.CreateInterpreterCall){
					var args=obj_buildenv.CreateInterpreterCall(fn_to_build,this);
					if(typeof(args)=='string'){
						//qpad js
						s_script='eval(IO.ReadAll('+fn_to_build,'));';
					}else{
						s_script=IO.ShellCmd(args);
						//if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
						//	s_script='if "%1"=="run" goto run\nstart /WAIT %0 run\ngoto end\n:run\n'+s_script+'\npause\nexit\n:end\n';
						//}
						if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
							s_script="rem [new window]\n"+s_script+"\npause";
						}else{
							s_script="# [new window]\n"+s_script+'\nread -n1 -r -p '+JSON.stringify(UI._("Press any key to continue..."))+' unused_key';
						}
					}
				}else{
					s_script=obj_buildenv.CreateBuildScript(fn_to_build,this)
				}
			}else{
				s_script="";
			}
			var s_mark=undefined;
			var s_language=undefined;
			var s_name_in_script="'"+fn_to_build+"'";
			if(is_project){
				s_name_in_script='the project'
				var s_button;
				if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
					s_button="rem [button: "+"Run project"+"]\n";
				}else{
					s_button="# [button: "+"Run project"+"]\n";
				}
				s_script=s_button+s_script;
			}
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				s_mark="@echo off\nrem build script for "+s_name_in_script+"\n";
				s_language="Windows BAT";
			}else{
				s_mark="#!/bin/sh\n#build script for "+s_name_in_script+"\n";
				s_language='Unix Shell Script';
			}
			var result_cell=UI.OpenNotebookCellFromEditor(this,s_mark,s_language,1,'input');
			if(result_cell){
				var obj_notebook=result_cell.obj_notebook;
				var cell_i=obj_notebook.m_cells[result_cell.cell_id];
				var doc_in=cell_i.m_text_in;
				var size=doc_in.ed.GetTextSize();
				if(size==Duktape.__byte_length(s_mark)){
					doc_in.ed.Edit([0,size,s_mark+s_script]);
					doc_in.m_cell_id=cell_i.m_cell_id;
					doc_in.CallOnChange();
				}
				UI.RefreshAllTabs()
			}
		}; 
		if(desc.name!='Markdown'){
			menu_run.AddNormalItem({text:"Create file cell",key:"CTRL+F7",enable_hotkey:1,action:fgencell.bind(this,0)})
			menu_run.AddNormalItem({text:"Create project cell",key:"F7",enable_hotkey:1,action:fgencell.bind(this,1)})
			menu_run.AddSeparator()
		}
		/////////////////
		var fruncell=function(is_project){
			var s_mark=undefined;
			var s_language=undefined;
			var s_name_in_script="'"+fn_to_build+"'";
			if(is_project){
				s_name_in_script='the project'
			}
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				s_mark="@echo off\nrem build script for "+s_name_in_script+"\n";
				s_language="Windows BAT";
			}else{
				s_mark="#!/bin/sh\n#build script for "+s_name_in_script+"\n";
				s_language='Unix Shell Script';
			}
			//"non_quiet"
			var bk_active_tab=UI.top.app.document_area.active_tab;
			var result_cell=UI.OpenNotebookCellFromEditor(this,s_mark,s_language,0,'output');
			if(result_cell){
				var obj_notebook=result_cell.obj_notebook;
				//var cell_i=obj_notebook.m_cells[result_cell.cell_id];
				//var doc_in=cell_i.m_text_in;
				//UI.SetFocus(doc_in)
				if(obj_notebook.RunCell(result_cell.cell_id)=="focus"){
					//if we got a cancel notification...
					bk_active_tab=undefined;
				}
			}else{
				//create cell and focus it
				fgencell.call(this,is_project)
				result_cell=UI.OpenNotebookCellFromEditor(this,s_mark,s_language,0,'output');
				if(result_cell){
					var obj_notebook=result_cell.obj_notebook;
					//var cell_i=obj_notebook.m_cells[result_cell.cell_id];
					//var doc_in=cell_i.m_text_in;
					//UI.SetFocus(doc_in)
					obj_notebook.RunCell(result_cell.cell_id)
				}
			}
			if(bk_active_tab!=undefined){
				UI.top.app.document_area.BringUpTab(bk_active_tab.__global_tab_id)
			}
			UI.Refresh()
		}.bind(this);
		/*if(obj_buildenv.CreateInterpreterCall){
			//run it without redirection
			menu_run.AddNormalItem({text:"&Run",enable_hotkey:1,key:"CTRL+F5",action:function(){
				if(this.owner){this.owner.Save();}
				if(this.NeedSave()){
					return;
				}
				var args=obj_buildenv.CreateInterpreterCall(this.m_file_name)
				if(typeof(args)=='string'){
					//qpad js
					try{
						eval(IO.ReadAll(this.m_file_name))
					}catch(e){
						//todo: produce output in a notification
					}
				}else{
					IO.Shell(args)
				}
			}.bind(this)})
		}else{*/
		var frunfile=function(){
			if(this.NeedSave()&&this.owner){this.owner.Save();}
			if(this.NeedSave()){
				return;
			}
			fruncell(0)
		}.bind(this);
		if(desc.name!='Markdown'){
			menu_run.AddNormalItem({text:"Build / &run file",icon:"放",enable_hotkey:1,key:"CTRL+F5",action:frunfile})
			/*}*/
			if(UI.HasFocus(this)&&obj_buildenv){
				UI.ToolButton("run",{tooltip:"Run - CTRL+F5",action:frunfile})
			}
			menu_run.AddNormalItem({text:"Build / run project",enable_hotkey:1,key:"F5",action:function(){
				//coulddo: save other files in the project
				if(this.NeedSave()&&this.owner){this.owner.Save();}
				if(this.NeedSave()){
					return;
				}
				fruncell(1)
			}.bind(this)})
		}
		menu_run.AddNormalItem({text:"&Stop all cells",icon:"停",enable_hotkey:0,action:function(){
			for(var i=0;i<UI.g_all_document_windows.length;i++){
				var obj_tab_i=UI.g_all_document_windows[i];
				if(obj_tab_i.document_type=="notebook"){
					if(obj_tab_i.main_widget){
						var obj_notebook=obj_tab_i.main_widget;
						if(obj_notebook.m_cells){
							for(var j=0;j<obj_notebook.m_cells.length;j++){
								obj_notebook.KillCell(j);
							}
						}
					}
				}
			}
		}})
		if(desc.m_buildenvs&&desc.m_buildenvs.length>1){
			menu_run.AddSeparator()
			for(var i=0;i<desc.m_buildenvs.length;i++){
				var s_name_i=desc.m_buildenvs[i].name;
				menu_run.AddNormalItem({
					text:s_name_i,
					enable_hotkey:0,
					key:s_name_i==s_name_default?"\u2605":undefined,
					icon:(obj_buildenv==desc.m_buildenv_by_name[s_name_i])?"对":undefined,
					action:function(name,s_lang_name,is_selected,is_default){
						if(is_selected&&!is_default){
							if(!UI.m_ui_metadata["<compiler_assoc>"]){
								UI.m_ui_metadata["<compiler_assoc>"]={};
							}
							UI.m_ui_metadata["<compiler_assoc>"][s_lang_name]=name;
						}
						this.m_compiler_name=name;
						UI.Refresh();
					}.bind(this,s_name_i,desc.name,
						obj_buildenv==desc.m_buildenv_by_name[s_name_i],s_name_i==s_name_default)})
			}
		}
		menu_run=undefined;
	})
}).prototype.desc={category:"Tools",name:"Build and run",stable_name:"build_and_run"};

///////////////////////
UI.RegisterBuildEnv("TeX/LaTeX",{
	name:"pdftexify",
	CreateBuildScript:function(fname,doc){
		var fname_pdf=UI.RemoveExtension(fname)+'.pdf';
		var cmdline_viewer=[
				"SumatraPDF","-reuse-instance",fname_pdf,
				"-inverse-search",'"'+IO.m_my_name+'" "%f" --seek %l'];
		if(doc){
			cmdline_viewer.push("-forward-search",fname,doc.GetLC(doc.sel1.ccnt)[0]+1);
		}
		return [
			IO.ShellCmd(["texify","--tex-option=--max-print-line=9999","-q","--pdf","--tex-option=--synctex=1",fname])," && ",
			IO.ShellCmd(cmdline_viewer),"\n",
		].join("");
	}
});

//compiled languages are not that important
if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
	var g_vc_compiler_path=undefined;
	var DetectVC=function(){
		if(g_vc_compiler_path){return g_vc_compiler_path;}
		var testbat=function(spath0){
			var spath=IO.ProcessUnixFileName(spath0);
			if(IO.FileExists(spath+"/vsvars32.bat")){return spath0;}
			return 0;
		}
		g_vc_compiler_path=(testbat("%VS120COMNTOOLS%")||testbat("%VS110COMNTOOLS%")||testbat("%VS100COMNTOOLS%")||testbat("%VS90COMNTOOLS%")||testbat("%VS80COMNTOOLS%"));
		if(!g_vc_compiler_path){return 0;}
		return g_vc_compiler_path;
	};
	UI.RegisterBuildEnv("C/C++/C#",{
		name:"Visual Studio",
		CreateBuildScript:function(fname,doc){
			var compiler_path=(DetectVC()||"???");
			return [
				'call "',
				(compiler_path+'/../../vc/bin/x86_amd64/vcvarsx86_amd64.bat').replace(/[/]/g,'\\'),
				'"\n',
				'cd /d ',UI.GetPathFromFilename(fname),'\n',
				'cl /Zi /D_HAS_ITERATOR_DEBUGGING=0 /D_SECURE_SCL=0 /D_SCL_SECURE_NO_WARNINGS /MT /DPM_C_MODE /DNEED_MAIN_WRAPPING ',fname,' || exit\n',
				UI.GetMainFileName(fname),'\n',
			].join("");
		}
	})
}

UI.RegisterBuildEnv("Jacy",{
	name:"jc",
	CreateBuildScript:function(fname,doc){
		return [
			UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?'cd /d ':'cd ',UI.GetPathFromFilename(fname),'\n',
			'jc ',UI.RemovePath(fname),' --run\n',
		].join("");
	}
})

UI.RegisterBuildEnv("Python",{
	name:"python",
	CreateInterpreterCall:function(fname,doc){
		return ["python",fname];
	}
})

UI.RegisterBuildEnv("Javascript",{
	name:"node.js",
	CreateInterpreterCall:function(fname,doc){
		return [UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"?"nodejs":"node",fname];
	}
})

//UI.RegisterBuildEnv("Javascript",{
//	name:"run in editor",
//	CreateInterpreterCall:function(fname,doc){
//		return "qpad js hack";
//	}
//})

UI.RegisterBuildEnv("Windows BAT",{
	name:"cmd",
	CreateInterpreterCall:function(fname,doc){
		return ["cmd","/c",fname];
	}
});

UI.RegisterBuildEnv("Unix Shell Script",{
	name:"exec",
	CreateInterpreterCall:function(fname,doc){
		return [UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?"sh.exe":"/bin/sh",fname];
	}
});

/////////////////////////////////////////////
UI.RegisterEditorPlugin(function(){
	//enhanced enter
	this.AddEventHandler('\n',function(){
		var ed=this.ed;
		var ccnt=this.GetSelection()[0]
		var ccnt_ehome=Math.min(this.GetEnhancedHome(ccnt),ccnt)
		var ccnt_lhome=this.SeekLC(this.GetLC(ccnt_ehome)[0],0)
		if(!(ccnt_ehome>ccnt_lhome)){return 1;}//don't intercept it
		this.OnTextInput({"text":"\n"+this.ed.GetText(ccnt_lhome,ccnt_ehome-ccnt_lhome),"is_paste":1})
		return 0;
	})
}).prototype.desc={category:"Editing",name:"Auto-indent",stable_name:"auto_indent"};

var CountSpacesAfter=function(ed,ccnt){
	return ed.MoveToBoundary(ccnt,1,"space")-ccnt;
}

var GetSpaceIndent=function(){
	var tab_width=UI.GetOption("tab_width",4);
	return Array(tab_width+1).join(' ');
};

var DeduceIndent=function(ed,ccnt){
	return ed.GetUtf8CharNeighborhood(ccnt)[1]==32?GetSpaceIndent():'\t';
};

UI.RegisterEditorPlugin(function(){
	//bracket-related auto-indent
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('RETURN RETURN2',function(){
		if(this.sel0.ccnt!=this.sel1.ccnt){return 1;}
		var ed=this.ed;
		var lang=this.plugin_language_desc
		var ccnt_pos=this.sel1.ccnt
		var chnext=String.fromCharCode(ed.GetUtf8CharNeighborhood(ccnt_pos)[1])
		var is_bracket_enabled=this.IsBracketEnabledAt(ccnt_pos)
		var is_lineend=this.IsLineEndAt(ccnt_pos)
		var did=0
		//Case 1: enter at a line with dangling lbra of any kind - we indent to the next line, or add a few tabs
		var lineno=this.GetLC(ccnt_pos)[0]
		var ccnt_lh=this.SeekLC(lineno,0)
		var blevel=this.GetBracketLevel(ccnt_pos)
		var ccnt_lbra=this.FindBracket(blevel-1,ccnt_pos,-1)
		var snewline="\n"
		//if(ed.LineEndingMode=="DOS"){
		//	snewline="\r\n"
		//}else{
		//	snewline="\n"
		//}
		var snewline0=snewline
		var delta_ccnt=Duktape.__byte_length(snewline)
		if(ccnt_lbra>=ccnt_lh){
			var ccnt_nextline=this.SeekLineBelowKnownPosition(ccnt_lh,lineno, lineno+1)
			if(ccnt_nextline>ccnt_lh&&this.IsLineEndAt(ccnt_nextline-1)){
				//there is a next line: indent to it
				var nspaces=CountSpacesAfter(ed,ccnt_nextline)
				var nspaces_curline=CountSpacesAfter(ed,ccnt_lh)
				if(nspaces<=nspaces_curline){
					//well... don't do it if the next line is less-indented
					var nspaces=CountSpacesAfter(ed,ccnt_lh)
					snewline=snewline+ed.GetText(ccnt_lh,nspaces)+DeduceIndent(ed,ccnt_lh);
				}else{
					snewline=snewline+ed.GetText(ccnt_nextline,nspaces)
				}
			}else{
				//add extra indent
				var nspaces=CountSpacesAfter(ed,ccnt_lh)
				snewline=snewline+ed.GetText(ccnt_lh,nspaces)+DeduceIndent(ed,ccnt_lh)
			}
			delta_ccnt=Duktape.__byte_length(snewline)
			did=1
		}
		//this applies in parallel with the dangling bracket rule
		if(chnext=='}'&&!lang.curly_bracket_is_not_special&&is_bracket_enabled){
			if(ccnt_lbra>=ccnt_lh){
				//Case 2: enter inside {}, we need to add an extra blank line for C-like langs
				//delta doesn't change
				var nspaces=CountSpacesAfter(ed,ccnt_lh);
				snewline=snewline+snewline0+ed.GetText(ccnt_lh,nspaces);
				did=1;
			}else{
				//Case 2.5: we're putting the } on the next line, indent it to the { level
				if(ccnt_lbra>=0){
					var lineno_lbra=this.GetLC(ccnt_lbra)[0]
					var ccnt_lh_lbra=this.SeekLC(lineno_lbra,0);
					var nspaces=CountSpacesAfter(ed,ccnt_lh_lbra);
					snewline=snewline0+ed.GetText(ccnt_lh_lbra,nspaces);
					delta_ccnt=Duktape.__byte_length(snewline)
					did=1;
				}else{
					//continue with the normal action
					return 1;
				}
			}
		}
		if(did){
			var sel=this.GetSelection()
			this.HookedEdit([sel[0],sel[1]-sel[0],snewline])
			this.CallOnChange()
			this.SetCaretTo(ccnt_pos+delta_ccnt)
			return 0
		}
		//Case 3: auto {} and auto ;, exclusive with Case 1/2
		//this one is more language dependent
		if(is_bracket_enabled&&lang.auto_curly_words&&is_lineend){
			var ch_lineend=String.fromCharCode(ed.GetUtf8CharNeighborhood(ccnt_pos)[0])
			var id_eh
			if(ch_lineend==')'){
				var ccnt_eh_bra0=this.FindBracket(blevel-2,ccnt_pos-1,-1)
				var ccnt_eh=ed.MoveToBoundary(ccnt_eh_bra0,-1,"space")
				var ccnt_eh0=ed.MoveToBoundary(ccnt_eh,-1,"word_boundary_left")
				id_eh=ed.GetText(ccnt_eh0,ccnt_eh-ccnt_eh0)
			}else{
				var ccnt_eh=ed.MoveToBoundary(ccnt_lh,1,"space")
				var ccnt_eh1=ed.MoveToBoundary(ccnt_eh,1,"word_boundary_right")
				id_eh=ed.GetText(ccnt_eh,ccnt_eh1-ccnt_eh)
			}
			var nspaces=CountSpacesAfter(ed,ccnt_lh)
			snewline=snewline+ed.GetText(ccnt_lh,nspaces)
			var acw=lang.auto_curly_words[id_eh]
			if((ch_lineend==')'||acw==2&&ch_lineend!=':'&&ch_lineend!=';'&&ch_lineend!=','&&ch_lineend!='\n'&&ch_lineend!='\\'&&ch_lineend)&&acw){
				//for(), if(), main(), ...
				//add {} and move cursor in between
				var delta_ccnt=Duktape.__byte_length(snewline)+2
				snewline="{"+snewline+DeduceIndent(ed,ccnt_lh)+snewline+"}"
				if(acw==2){
					snewline=snewline+';'
				}
				var sel=this.GetSelection()
				this.HookedEdit([sel[0],sel[1]-sel[0],snewline])
				this.CallOnChange()
				this.SetCaretTo(ccnt_pos+delta_ccnt)
				return 0
			}else{
				//test left { and stuff, add ; if found
				var ccnt_left_bra=this.FindBracket(blevel-1,ccnt_pos,-1)
				if((ccnt_left_bra<0||ed.GetUtf8CharNeighborhood(ccnt_left_bra)[1]=='{')&&ch_lineend!='{'&&ch_lineend!='}'&&ch_lineend!=':'&&ch_lineend!=';'&&ch_lineend!=','&&ch_lineend!='\n'&&ch_lineend!='\\'&&ch_lineend){
					if(lang.paired_comment){
						var paired_comment1=lang.paired_comment[1]
						if(ccnt_pos>=Duktape.__byte_length(paired_comment1)){
							if(ed.GetText(ccnt_pos-Duktape.__byte_length(paired_comment1),Duktape.__byte_length(paired_comment1))==paired_comment1){
								//don't add ; after /**/
								return 1
							}
						}
					}
					var lineno=this.GetLC(ccnt_pos)[0]
					var ccnt_lh=this.SeekLC(lineno,0)
					if(ed.MoveToBoundary(ccnt_lh,1,"space")==ccnt_pos){
						//don't add ; to a blank line
						return 1;
					}
					if(id_eh=="template"||ccnt_pos>=1&&ed.GetUtf8CharNeighborhood(ccnt_pos)[0]=='>'){
						//don't add ; to a template line
						return 1;
					}
					snewline=";"+snewline
					delta_ccnt=Duktape.__byte_length(snewline)
					var sel=this.GetSelection()
					this.HookedEdit([sel[0],sel[1]-sel[0],snewline])
					this.CallOnChange()
					this.SetCaretTo(ccnt_pos+delta_ccnt)
					return 0
				}
			}
		}
		return 1
	})
	this.AddEventHandler('BACKSPACE',function(){
		if(this.sel0.ccnt!=this.sel1.ccnt){return 1;}
		var ccnt_pos=this.sel1.ccnt;
		var lineno=this.GetLC(ccnt_pos)[0]
		var ccnt_lh=this.SeekLC(lineno,0)
		if(ccnt_pos!=this.ed.MoveToBoundary(ccnt_lh,1,"space")){return 1}
		if(this.ed.GetUtf8CharNeighborhood(ccnt_pos)[0]!=32){return 1;}//only do this for space indent
		var ccnt_indent=this.FindOuterIndentation(ccnt_pos);
		var ccnt_indent_lh=this.ed.MoveToBoundary(ccnt_indent,-1,"space")
		var n_remaining=ccnt_indent-ccnt_indent_lh;
		if(!n_remaining||ccnt_lh+n_remaining<this.ed.GetTextSize()&&this.ed.GetText(ccnt_indent_lh,n_remaining)==this.ed.GetText(ccnt_lh,n_remaining)){
			if(ccnt_lh+n_remaining<ccnt_pos){
				//delete to previous indent
				this.HookedEdit([ccnt_lh+n_remaining,ccnt_pos-(ccnt_lh+n_remaining),null])
				this.CallOnChange()
				this.CallOnSelectionChange()
				UI.Refresh()
				return 0;
			}
		}
		return 1;
	})
	var f_key_test=function(C){
		if(this.sel0.ccnt!=this.sel1.ccnt){return 1;}
		var ccnt_pos=this.sel1.ccnt
		if(!this.IsLineEndAt(ccnt_pos)){return 1}
		var ed=this.ed;
		var lang=this.plugin_language_desc
		var lineno=this.GetLC(ccnt_pos)[0]
		var ccnt_lh=this.SeekLC(lineno,0)
		if(ccnt_pos!=ed.MoveToBoundary(ccnt_lh,1,"space")){return 1}
		if(!this.IsBracketEnabledAt(ccnt_pos)){return 1}
		var blevel=this.GetBracketLevel(ccnt_pos)
		var ccnt_lbra=this.FindBracket(blevel-1,ccnt_pos,-1)
		if(ccnt_lbra<0){return 1;}
		var C_other=MatchingBracket(C)
		if(ed.GetUtf8CharNeighborhood(ccnt_lbra)[1]!=C_other.charCodeAt(0)){return 1;}
		//dedent it
		var ccnt_lh_lbra=this.SeekLC(this.GetLC(ccnt_lbra)[0],0)
		var nspaces_ours=CountSpacesAfter(ed,ccnt_lh)
		var nspaces_lbra=CountSpacesAfter(ed,ccnt_lh_lbra)
		if(nspaces_ours<=nspaces_lbra){return 1}
		if(ed.GetText(ccnt_lh,nspaces_lbra)!=ed.GetText(ccnt_lh_lbra,nspaces_lbra)){return 1;}
		this.HookedEdit([ccnt_lh+nspaces_lbra,nspaces_ours-nspaces_lbra,null, ccnt_pos,0,C])
		this.CallOnChange()
		this.SetCaretTo(ccnt_lh+nspaces_lbra+Duktape.__byte_length(C))
		return 0;
	}
	var listening_keys=[")","]","}"]
	for(var i=0;i<listening_keys.length;i++){
		var C=listening_keys[i];
		this.AddEventHandler(C,f_key_test.bind(this,C))
	}
}).prototype.desc={category:"Editing",name:"Advanced auto-indent",stable_name:"adv_auto_indent"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)&&UI.SDL_HasClipboardText()&&(!this.owner||!this.owner.read_only)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			var menu_edit_children=menu_edit.$
			var bk_children=menu_edit_children.slice(menu_edit.p_paste,menu_edit_children.length);
			menu_edit.$=menu_edit_children.slice(0,menu_edit.p_paste);
			menu_edit_children=undefined;
			menu_edit.AddNormalItem({text:"Smart paste",icon:"粘",context_menu_group:"edit",enable_hotkey:1,key:"SHIFT+CTRL+V",action:function(){
				this.SmartPaste()
			}.bind(this)})
			menu_edit.$=menu_edit.$.concat(bk_children)
			menu_edit=undefined;
		}
	})
})//.prototype.desc={category:"Editing",name:"Smart paste",stable_name:"smart_paste"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.owner||!this.plugin_language_desc.spell_checker){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddNormalItem({
					text:"Check &spelling",
					icon:(this.m_spell_checker&&this.m_spell_checker!="none")?"■":"□",
					action:function(){
				this.m_spell_checker=(this.m_spell_checker&&this.m_spell_checker!="none"?"none":this.plugin_language_desc.spell_checker)
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				renderer.ResetSpellChecker(this)
				UI.Refresh()
			}.bind(this)})
			menu_edit=undefined;
		}
	})
});//.prototype.desc={category:"Display",name:"Enable spell checks"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({
					text:"Auto &wrap",
					icon:this.m_enable_wrapping?"■":"□",
					enable_hotkey:1,key:"SHIFT+CTRL+W",
					action:function(){
				this.m_enable_wrapping=(this.m_enable_wrapping?0:1)
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				var ed_caret_original=this.GetCaretXY();
				var scroll_y_original=this.scroll_y;
				renderer.ResetWrapping(this.m_enable_wrapping?(this.m_current_wrap_width||((UI.IS_MOBILE||UI.Platform.ARCH=="web")?768:1024)):0,this)
				this.caret_is_wrapped=0
				this.ed.InvalidateStates([0,this.ed.GetTextSize()])
				var ed_caret_new=this.GetCaretXY();
				this.scroll_y=scroll_y_original-ed_caret_original.y+ed_caret_new.y;
				this.AutoScroll("show")
				this.scrolling_animation=undefined
				this.CallHooks("wrap")
				UI.Refresh()
			}.bind(this)})
			menu_edit=undefined;
		}
	})
});//.prototype.desc={category:"Display",name:"Enable auto wrap"};

//cut line / delete word
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({icon:"切",text:"Cut &line",enable_hotkey:1,key:"CTRL+L",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				sel[0]=this.SeekLC(this.GetLC(sel[0])[0],0)
				sel[1]=this.SeekLC(this.GetLC(sel[1])[0]+1,0)
				if(sel[0]<sel[1]){
					this.sel0.ccnt=sel[0]
					this.sel1.ccnt=sel[1]
					this.Cut()
					return 0
				}else{
					return 1
				}
			}.bind(this)})
			menu_edit.AddNormalItem({text:"Delete word",enable_hotkey:1,key:"CTRL+T",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				sel[0]=ed.MoveToBoundary(sel[0],-1,"word_boundary_left")
				sel[1]=ed.MoveToBoundary(sel[1],1,"word_boundary_right")
				if(sel[0]<sel[1]){
					this.HookedEdit([sel[0],sel[1]-sel[0],undefined])
					this.CallOnChange()
					this.SetCaretTo(sel[0])
					return 0
				}else{
					return 1
				}
			}.bind(this)})
			menu_edit=undefined;
		}
	})
})//.prototype.desc={category:"Editing",name:"Line / word deletion",stable_name:"line_word_del"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	var fcomment=function(){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var sel=this.GetSelection();
		var line0=this.GetLC(sel[0])[0];
		var line1=this.GetLC(sel[1])[0];
		var cmt_holder=lang;
		if(lang.GetCommentStrings){
			cmt_holder=lang.GetCommentStrings(this.ed.GetStateAt(this.ed.m_handler_registration["colorer"],sel[0],"ill")[0]);
		}
		if((line0==line1&&sel[0]<sel[1]||!cmt_holder.line_comment)&&cmt_holder.paired_comment){
			var s0=cmt_holder.paired_comment[0]
			var s1=cmt_holder.paired_comment[1]
			var lg0=Duktape.__byte_length(s0)
			var lg1=Duktape.__byte_length(s1)
			if(ed.GetText(sel[0],lg0)==s0&&ed.GetText(sel[1]-lg1,lg1)==s1){
				this.HookedEdit([sel[0],lg0,undefined,sel[1]-lg1,lg1,undefined])
				this.CallOnChange()
				this.SetSelection(sel[0],sel[1]-lg0-lg1)
			}else{
				this.HookedEdit([sel[0],0,s0,sel[1],0,s1])
				this.CallOnChange()
				this.SetSelection(sel[0],sel[1]+lg0+lg1)
			}
			UI.Refresh();
			return 0;
		}
		if(!cmt_holder.line_comment){
			return 1
		}
		if(line0==line1||this.SeekLC(line1,0)<sel[1]){line1++;}
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+1);
		var line_ccnts_new=[];
		var ops=[];
		var is_decomment=1
		var s0=cmt_holder.line_comment
		var lg0=Duktape.__byte_length(s0)
		var min_n_spaces=undefined;
		for(var i=0;i<line_ccnts.length-1;i++){
			var ccnt0=line_ccnts[i];
			var ccnt_eh=ed.MoveToBoundary(ccnt0,1,"space")
			if(ed.GetUtf8CharNeighborhood(ccnt0)[0]==10&&ed.GetUtf8CharNeighborhood(ccnt_eh)[1]==10){
				//skip empty lines
				continue;
			}
			if(min_n_spaces==undefined||min_n_spaces>(ccnt_eh-ccnt0)){
				min_n_spaces=ccnt_eh-ccnt0;
			}
			ccnt_eh=Math.min(ccnt_eh,ccnt0+min_n_spaces);
			line_ccnts_new.push(ccnt_eh)
			if(is_decomment&&ed.GetText(ccnt_eh,lg0)!=s0){
				is_decomment=0
			}
		}
		for(var i=0;i<line_ccnts_new.length;i++){
			var ccnt0=line_ccnts_new[i];
			if(is_decomment){
				ops.push(ccnt0,lg0,undefined)
			}else{
				ops.push(ccnt0,0,s0)
			}
		}
		if(ops.length){
			this.HookedEdit(ops)
			this.CallOnChange()
			UI.Refresh();
			return 0;
		}else{
			return 1;
		}
		return 1
	}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({icon:"释",text:"Toggle c&omment",enable_hotkey:1,key:"CTRL+K",action:fcomment.bind(this)})
			menu_edit=undefined;
			this.AddTransientHotkey('CTRL+/',fcomment.bind(this));
		}
	})
})//.prototype.desc={category:"Editing",name:"Comment / uncomment",stable_name:"toggle_comment"};

UI.RegisterEditorPlugin(function(){
	//tab indent, shift+tab dedent
	if(!this.tab_is_char){return;}
	var indentText=function(delta){
		var ed=this.ed;
		var sel=this.GetSelection();
		if(sel[0]==sel[1]){return 1;}
		var line0=this.GetLC(sel[0])[0];
		var line1=this.GetLC(sel[1])[0];
		if(this.SeekLC(line1,0)<sel[1]){line1++;}
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+1);
		var ops=[];
		for(var i=0;i<line_ccnts.length-1;i++){
			var ccnt0=line_ccnts[i];
			var ccnt1=line_ccnts[i+1];
			if(delta>0){
				ops.push(ccnt0,0,DeduceIndent(ed,ccnt0))
			}else{
				if(ccnt0<ccnt1){
					var ch=ed.GetUtf8CharNeighborhood(ccnt0)[1];
					if(ch==32||ch==9){
						ops.push(ccnt0,1,null)
					}
				}
			}
		}
		if(ops.length){
			this.HookedEdit(ops)
			this.CallOnChange()
			UI.Refresh();
			return 0;
		}else{
			return 1;
		}
	}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			if(sel[0]<sel[1]){
				var menu_edit=UI.BigMenu("&Edit")
				var obj=this
				menu_edit.AddSeparator()
				menu_edit.AddNormalItem({text:"&Indent selection",enable_hotkey:0,key:"TAB",action:function(){
					return indentText.call(obj,1)
				}})
				menu_edit.AddNormalItem({text:"&Dedent selection",enable_hotkey:0,key:"SHIFT+TAB",action:function(){
					return indentText.call(obj,-1)
				}})
				this.AddTransientHotkey('TAB',function(){
					return indentText.call(this,1)
				})
				this.AddTransientHotkey('SHIFT+TAB',function(){
					return indentText.call(this,-1)
				})
				menu_edit=undefined;
			}
		}
	})
})//.prototype.desc={category:"Editing",name:"Tab indent / dedent",stable_name:"indent_dedent"};

UI.RegisterEditorPlugin(function(){
	//alt+pgup/pgdn
	if(this.plugin_class!="code_editor"){return;}
	this.m_outer_scope_queue=[]
	var fouter_scope=function(){
		var ed=this.ed;
		var ccnt_new=this.FindOuterLevel(this.sel1.ccnt).ccnt_editor;
		if(ccnt_new>=0){
			this.m_outer_scope_queue.push(this.sel1.ccnt)
			this.m_outer_scope_queue_just_pushed=ccnt_new
			this.SetCaretTo(ccnt_new)
			return 0;
		}
		return 1;
	}
	var finner_scope=function(){
		if(this.m_outer_scope_queue.length){
			var ccnt_new=this.m_outer_scope_queue.pop()
			this.m_outer_scope_queue_just_pushed=ccnt_new
			this.SetCaretTo(ccnt_new)
			return 0;
		}
	}
	this.AddEventHandler('ALT+PGUP',fouter_scope)
	this.AddEventHandler('ALT+PGDN',finner_scope)
	this.AddEventHandler('selectionChange',function(){
		if(this.sel0.ccnt==this.m_outer_scope_queue_just_pushed&&
		this.sel1.ccnt==this.m_outer_scope_queue_just_pushed){
			return;
		}
		this.m_outer_scope_queue=[];
		this.m_outer_scope_queue_just_pushed=undefined
	})
	this.AddEventHandler('change',function(){this.m_outer_scope_queue=[];})
	//alt+up/down
	var fscopeup=function(){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(this.sel1.ccnt);
		var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",Math.max(this.sel1.ccnt-1-this.GetLC(this.sel1.ccnt)[1],0),-1);
		if(ccnt_new>=0){
			this.SetCaretTo(ccnt_new)
			return 0;
		}
		return 1
	}
	var fscopedown=function(){
		var ed=this.ed;
		var id_indent=ed.m_handler_registration["seeker_indentation"]
		var my_level=this.GetIndentLevel(this.sel1.ccnt);
		var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",this.SeekLC(this.GetLC(this.sel1.ccnt)[0]+1),1);
		if(ccnt_new>=0){
			this.SetCaretTo(ccnt_new)
			return 0;
		}
		return 1
	}
	this.AddEventHandler('ALT+UP',fscopeup)
	this.AddEventHandler('ALT+DOWN',fscopedown)
	/////////////////////////
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			menu_search.AddSeparator();
			menu_search.AddButtonRow({text:"Scope"},[
				{text:"scope_outer",icon:"外",tooltip:'Outer - ALT+PGUP',action:function(){
					fouter_scope.call(doc)
				}},{text:"scope_inner",icon:"内",tooltip:'Inner - ALT+PGDN',action:function(){
					finner_scope.call(doc)
				}}])
			menu_search.AddButtonRow({text:"Lines of the same indentation"},[
				{text:"indent_up",icon:"上",tooltip:'Prev - ALT+UP',action:function(){
					fscopeup.call(doc)
				}},{text:"indent_down",icon:"下",tooltip:'Next - ALT+DOWN',action:function(){
					fscopedown.call(doc)
				}}])
		}
	})
})//.prototype.desc={category:"Controls",name:"Moving across scopes",stable_name:"scope_moving"};

//control up/down
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class=="widget"){return;}
	//ctrl+up/down
	this.AddEventHandler('CTRL+UP',function(){
		this.scroll_y-=this.GetCharacterHeightAtCaret();
		if(!(this.scroll_y>0)){
			this.scroll_y=0;
		}
		var ed_caret=this.GetCaretXY();
		if(ed_caret.y>this.scroll_y+this.h){
			var bk=this.x_updown;
			this.MoveCursorToXY(this.x_updown,ed_caret.y-1.0);
			this.sel0.ccnt=this.sel1.ccnt
			this.x_updown=bk;
		}
		UI.Refresh();
		return 0
	})
	this.AddEventHandler('CTRL+DOWN',function(){
		var ed=this.ed
		var ccnt_tot=ed.GetTextSize();
		var ytot=ed.XYFromCcnt(ccnt_tot).y+ed.GetCharacterHeightAt(ccnt_tot);
		var hc=this.GetCharacterHeightAtCaret();
		var page_height=this.h;
		this.scroll_y=Math.min(this.scroll_y+hc,ytot-page_height);
		if(!(this.scroll_y>0)){
			this.scroll_y=0;
		}
		var ed_caret=this.GetCaretXY();
		if(ed_caret.y<this.scroll_y+(this.h_top_hint||0)){
			var bk=this.x_updown;
			this.MoveCursorToXY(this.x_updown,ed_caret.y+hc);
			this.sel0.ccnt=this.sel1.ccnt
			this.x_updown=bk;
		}
		UI.Refresh();
		return 0
	})
})//.prototype.desc={category:"Controls",name:"Keyboard scrolling",stable_name:"keyboard_scroll"};

//bookmarking
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	//the numbered guys
	for(var i=0;i<10;i++){
		(function(i){
			this.AddEventHandler('SHIFT+CTRL+'+i.toString(),function(){
				var ed=this.ed;
				var ccnt=this.sel1.ccnt;
				if(!this.m_bookmarks[i]){
					this.m_bookmarks[i]=ed.CreateLocator(ccnt,-1)
				}else{
					if(this.m_bookmarks[i].ccnt==ccnt){
						this.m_bookmarks[i].discard();
						this.m_bookmarks[i]=undefined;
					}else{
						this.m_bookmarks[i].ccnt=ccnt
					}
				}
				UI.Refresh()
				return 0;
			});
			this.AddEventHandler('CTRL+'+i.toString(),function(){
				var ed=this.ed;
				var ccnt=this.sel1.ccnt;
				if(this.m_bookmarks[i]){
					//this.SetCaretTo(this.m_bookmarks[i].ccnt)
					var ccnt_bm=this.m_bookmarks[i].ccnt
					UI.SetSelectionEx(this,ccnt_bm,ccnt_bm,"bookmark")
					this.AutoScroll("center")
					return 0
				}
				return 1;
			});
		}).call(this,i)
	}
	//the unmarked guys
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			//don't put anything up for the numbered guys
			menu_search.AddSeparator();
			menu_search.AddNormalItem({text:"Set &bookmark",icon:"签",enable_hotkey:1,key:'SHIFT+CTRL+Q',action:function(){
				var ed=this.ed;
				var ccnt=this.sel1.ccnt;
				var bm0=this.FindNearestBookmark(ccnt,1)
				if(bm0&&bm0.ccnt==ccnt){
					this.DeleteBookmark(bm0)
				}else{
					this.m_unkeyed_bookmarks.push(ed.CreateLocator(ccnt,-1))
				}
				UI.Refresh()
				return 0;
			}.bind(this)})
		}
	});
	this.ToggleBookmarkOnLine=function(line){
		var line_ccnts=this.SeekAllLinesBetween(line,line+2,"valid_only");
		if(line_ccnts[0]<line_ccnts[1]){
			//detect
			var ccnt0=line_ccnts[0];
			var ccnt1=line_ccnts[1];
			if(ccnt1==this.ed.GetTextSize()){
				ccnt1++;
			}
			var did=0;
			for(var i=0;i<this.m_bookmarks.length;i++){
				if(this.m_bookmarks[i]&&this.m_bookmarks[i].ccnt>=ccnt0&&this.m_bookmarks[i].ccnt<ccnt1){
					this.m_bookmarks[i].discard();
					this.m_bookmarks[i]=undefined;
					did=1;
				}
			}
			var bm_new=[];
			for(var i=0;i<this.m_unkeyed_bookmarks.length;i++){
				var bm_i=this.m_unkeyed_bookmarks[i];
				if(bm_i&&bm_i.ccnt>=ccnt0&&bm_i.ccnt<ccnt1){
					bm_i.discard();
					bm_i=undefined;
					did=1;
				}else{
					bm_new.push(bm_i);
				}
			}
			if(did){
				this.m_unkeyed_bookmarks=bm_new;
				UI.Refresh();
				return;
			}
		}
		this.m_unkeyed_bookmarks.push(this.ed.CreateLocator(ccnt0,-1));
		UI.Refresh();
	}
})//.prototype.desc={category:"Controls",name:"Bookmarks",stable_name:"bookmarks"};

//point of interest
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	var fnextbm=function(dir,is_sel){
		var ccnt=this.sel1.ccnt;
		var sz=this.ed.GetTextSize()
		var ccnt_next=undefined;
		var propose=UI.HackCallback(function(ccnt_cand){
			if(dir>0){
				if(ccnt<ccnt_cand&&(ccnt_next>ccnt_cand||ccnt_next==undefined)){ccnt_next=ccnt_cand;}
			}else{
				if(ccnt>ccnt_cand&&(ccnt_next<ccnt_cand||ccnt_next==undefined)){ccnt_next=ccnt_cand;}
			}
		});
		//bookmark
		var bm=(dir>0?this.FindNearestBookmark(ccnt+1,1):this.FindNearestBookmark(ccnt-1,-1))
		if(bm){
			propose(bm.ccnt);
		}
		//modification
		if(this.m_diff_from_save){
			//coulddo: round-to-line
			var ccnt_starting=this.sel1.ccnt;
			var ccnt_base_starting=this.m_diff_from_save.CurrentToBase(ccnt_starting)
			var ccnt_both_starting=this.m_diff_from_save.CurrentToBoth(ccnt_starting)
			//go to both
			var l=0;
			var r=(dir>0?sz-ccnt_starting:ccnt_starting);
			while(l<=r){
				var m=(l+r)>>1;
				var ccnt_base_m=this.m_diff_from_save.CurrentToBase(ccnt_starting+dir*m)
				var ccnt_both_m=this.m_diff_from_save.CurrentToBoth(ccnt_starting+dir*m)
				if((ccnt_both_m-ccnt_both_starting)*dir>0){
					r=m-1;
				}else{
					l=m+1;
				}
			}
			if(r>0){
				ccnt_starting+=r*dir;
				var ccnt_base_starting=this.m_diff_from_save.CurrentToBase(ccnt_starting)
				var ccnt_both_starting=this.m_diff_from_save.CurrentToBoth(ccnt_starting)
			}
			//go to edit
			l=0;r=(dir>0?sz-ccnt_starting:ccnt_starting);
			while(l<=r){
				var m=(l+r)>>1;
				var ccnt_base_m=this.m_diff_from_save.CurrentToBase(ccnt_starting+dir*m)
				var ccnt_both_m=this.m_diff_from_save.CurrentToBoth(ccnt_starting+dir*m)
				if(ccnt_both_m-ccnt_both_starting==dir*m&&ccnt_base_m-ccnt_base_starting==dir*m){
					l=m+1;
				}else{
					r=m-1;
				}
			}
			if(r>0){
				ccnt_starting+=r*dir;
				if(ccnt_starting!=0&&ccnt_starting!=sz){
					propose(ccnt_starting);
				}
			}
		}
		//build error
		if(this.m_error_overlays){
			for(var i=0;i<this.m_error_overlays.length;i++){
				var err=this.m_error_overlays[i];
				var ccnt_err0=err.sel_ccnt0?err.sel_ccnt0.ccnt:err.ccnt0;
				var ccnt_err1=err.sel_ccnt1?err.sel_ccnt1.ccnt:err.ccnt1;
				if(ccnt_err0<=ccnt&&ccnt<=ccnt_err1){continue;}
				propose(ccnt_err0);
			}
		}
		//spell error
		//there are too many of them, not worth it
		//actually go there
		if(ccnt_next==undefined){return 1;}
		if(is_sel){
			this.SetSelection(ccnt,ccnt_next)
		}else{
			UI.SetSelectionEx(this,ccnt_next,ccnt_next,"poi")
		}
		return 0;
	}
	this.AddEventHandler('SHIFT+F2',function(){fnextbm.call(this,-1)})
	this.AddEventHandler('F2',function(){fnextbm.call(this,1)})
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			menu_search.AddSeparator();
			menu_search.AddButtonRow({icon:"地",text:"Go to point of interest"},[
				{text:"bookmark_up",icon:"上",tooltip:'Prev - SHIFT+F2',action:function(){
					fnextbm.call(doc,-1)
				}},{text:"bookmark_down",icon:"下",tooltip:'Next - F2',action:function(){
					//text:"&select to"
					fnextbm.call(doc,1)
				}}])
			menu_search.AddButtonRow({text:"Select to point of interest"},[
				{text:"bookmark_sel_up",icon:"上",tooltip:'Prev',action:function(){
					fnextbm.call(doc,-1,1)
				}},{text:"bookmark_sel_down",icon:"下",tooltip:'Next',action:function(){
					//text:"&select to"
					fnextbm.call(doc,1,1)
				}}])
		}
	})
})//.prototype.desc={category:"Controls",name:"Points of interest",stable_name:"poi_moving"};

////////////////////////////////////
//C-like
var MatchingBracket=function(c){
	if(c=='('){return ')';}
	if(c=='['){return ']';}
	if(c=='{'){return '}';}
	if(c=='<'){return '>';}
	if(c==')'){return '(';}
	if(c==']'){return '[';}
	if(c=='}'){return '{';}
	if(c=='>'){return '<';}
	return c
}

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	if(!this.plugin_language_desc||this.plugin_language_desc.name=="Plain text"){return;}
	//bracket auto-matching with bold bracket highlighting
	this.AddEventHandler('editorCreate',function(){
		var hl_items=this.CreateTransientHighlight({
			'depth':1,
			'color':this.color,
			'display_mode':UI.HL_DISPLAY_MODE_EMBOLDEN,
			'invertible':0,
		});
		this.m_lbracket_p0=hl_items[0]
		this.m_lbracket_p1=hl_items[1]
		this.m_lbracket_hl=hl_items[2]
		hl_items=this.CreateTransientHighlight({
			'depth':1,
			'color':this.color,
			'display_mode':UI.HL_DISPLAY_MODE_EMBOLDEN,
			'invertible':0,
		});
		this.m_rbracket_p0=hl_items[0]
		this.m_rbracket_p1=hl_items[1]
		this.m_rbracket_hl=hl_items[2]
	})
	var HighlightBrackets=function(doc,ccnt0,ccnt1){
		var sz0=doc.BracketSizeAt(ccnt0,0),sz1=doc.BracketSizeAt(ccnt1,1)
		doc.m_lbracket_p0.ccnt=ccnt0+1-sz0
		doc.m_lbracket_p1.ccnt=ccnt0+1
		doc.m_rbracket_p0.ccnt=ccnt1+1-sz1
		doc.m_rbracket_p1.ccnt=ccnt1+1
		UI.Refresh()
	}
	var fcheckbrackets=function(){
		var ccnt=this.sel1.ccnt
		var lang=this.plugin_language_desc
		var ccnt_right=this.FindOuterBracket(ccnt,1)
		if(ccnt_right>=0){
			var ccnt_left=this.FindOuterBracket(ccnt,-1)
			if(ccnt_left>=0){
				HighlightBrackets(this,ccnt_left,ccnt_right-1)
				return
			}
		}
		this.m_lbracket_p0.ccnt=0
		this.m_lbracket_p1.ccnt=0
		this.m_rbracket_p0.ccnt=0
		this.m_rbracket_p1.ccnt=0
		//sth like IsBracketEnabled, m_lbracket_tokens, m_rbracket_tokens
		//return ed.GetStateAt(ed.m_handler_registration["colorer"],ccnt,"lll")[1];
	}
	this.AddEventHandler('selectionChange',fcheckbrackets)
	this.AddEventHandler('change',fcheckbrackets)
	var goto_matching_bracket=function(is_sel){
		var ccnt=this.sel1.ccnt
		if(!(this.m_lbracket_p0.ccnt<this.m_lbracket_p1.ccnt)){
			//coulddo: notification
			return;
		}
		var ccnt_new;
		if(ccnt==this.m_lbracket_p0.ccnt||ccnt==this.m_lbracket_p1.ccnt){
			ccnt_new=this.m_rbracket_p0.ccnt;
		}else if(ccnt==this.m_rbracket_p0.ccnt||ccnt==this.m_rbracket_p1.ccnt){
			ccnt_new=this.m_lbracket_p1.ccnt;
		}else{
			//UI.assert(0,"panic: bracket highlighting enabled but cursor is not at a bracket?")
			ccnt_new=this.m_lbracket_p1.ccnt;
			//ccnt=this.m_rbracket_p1.ccnt;
			//return;
		}
		if(is_sel){
			this.SetSelection(ccnt,ccnt_new)
		}else{
			UI.SetSelectionEx(this,ccnt_new,ccnt_new,"parenthesis")
		}
		this.CallOnSelectionChange();
	}
	this.AddEventHandler('menu',function(){
		var enabled=(this.m_lbracket_p0.ccnt<this.m_lbracket_p1.ccnt)
		if(UI.HasFocus(this)&&enabled){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			var ccnt=this.sel1.ccnt
			var sicon="｛";
			if(ccnt==this.m_lbracket_p0.ccnt||ccnt==this.m_lbracket_p1.ccnt){
				sicon="｝";
			}
			menu_search.AddSeparator();
			menu_search.AddButtonRow({icon:"プ",text:"Parenthesis"},[
				{text:"parenthesis_match",icon:sicon,tooltip:'Go to matching - CTRL+P',action:function(){
					goto_matching_bracket.call(doc,0)
				}},{text:"parenthesis_sel",icon:"选",tooltip:'Select between - SHIFT+CTRL+P',action:function(){
					//text:"&select to"
					goto_matching_bracket.call(doc,1);
				}}])
		}
	})
	this.AddEventHandler('CTRL+P',function(){goto_matching_bracket.call(this,0)})
	this.AddEventHandler('SHIFT+CTRL+P',function(){goto_matching_bracket.call(this,1)})
}).prototype.desc={category:"Display",name:"Show matching parenthesis",stable_name:"parenthesis_match"};

var bracket_context_prototype={
	PopBacStack:function(){
		if(this.current_bracket_ac_ccnt_range){
			var rg=this.current_bracket_ac_ccnt_range
			for(var i=0;i<rg.length;i++){
				rg[i].discard();
			}
		}
		if(this.bac_stack.length){
			this.current_bracket_ac=this.bac_stack.pop()
			this.current_bracket_ac_bralevel=this.bac_stack.pop()
			this.current_bracket_ac_ccnt_range=this.bac_stack.pop()
		}else{
			this.current_bracket_ac=0
			this.current_bracket_ac_bralevel=0
			this.current_bracket_ac_ccnt_range=undefined
		}
	}
}

UI.RegisterEditorPlugin(function(){
	//bracket completion
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.m_bracket_ctx={
		bac_stack:[],
		isin:0,
		current_bracket_ac:0,
		current_bracket_ac_bralevel:0,
		detecting_bad_curly:0,
		current_bracket_ac_ccnt_range:undefined,
		bad_curly_locator:0,
	}
	Object.setPrototypeOf(this.m_bracket_ctx,bracket_context_prototype)
	////////////
	//this.AddEventHandler('editorCreate',function(){
	//	var ed=this.ed;
	//	var ctx=this.m_bracket_ctx;
	//	ctx.current_bracket_ac_ccnt_range=[ed.CreateLocator(0,-1),ed.CreateLocator(0,-1)]
	//	ctx.bad_curly_locator=ed.CreateLocator(0,-1)
	//})
	//we need a *stack* of locators
	this.AddEventHandler('change',function(){
		var ctx=this.m_bracket_ctx;
		if(ctx.detecting_bad_curly){
			ctx.detecting_bad_curly=0
		}
	})
	this.AddEventHandler('}',function(){
		var ctx=this.m_bracket_ctx;
		var ed=this.ed;
		if(ctx.detecting_bad_curly){
			var ccnt_pos=this.sel1.ccnt
			var bad_curly_ac_ccnt=ctx.bad_curly_locator.ccnt+1
			//{ + move away + }
			//the pair have to be would-be matches: level test, after-ness test
			var blevel=this.GetBracketLevel(ccnt_pos)
			if(ccnt_pos>bad_curly_ac_ccnt&&blevel==this.GetBracketLevel(bad_curly_ac_ccnt)-1){
				//the final left-bra test
				var ccnt_left_bra=this.FindBracket(blevel-1,ccnt_pos,-1)
				if(ccnt_left_bra<bad_curly_ac_ccnt&&String.fromCharCode(ed.GetUtf8CharNeighborhood(bad_curly_ac_ccnt)[1])=='}'){
					//we should indeed cancel out the previous }
					//but any auto-completion should continue normally
					var sel=this.GetSelection()
					var ops=[bad_curly_ac_ccnt,1,null, sel[0],sel[1]-sel[0],'}']
					this.HookedEdit(ops)
					this.CallOnChange()
					this.SetCaretTo(sel[0])
					return 0
				}
			}
		}
		return 1
	})
	this.AddEventHandler('selectionChange',function(){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccntmin=sel_new[0]
		var ccntmax=sel_new[1]
		for(;ctx.current_bracket_ac_ccnt_range;){
			var ccnt_range0=ctx.current_bracket_ac_ccnt_range[0].ccnt
			var ccnt_range1=ctx.current_bracket_ac_ccnt_range[1].ccnt
			if(ccntmin<=ccnt_range0||ccntmax>=ccnt_range1){
				if(ctx.bac_stack.length==0&&ctx.current_bracket_ac=='}'&&!lang.curly_bracket_is_not_special){
					ctx.detecting_bad_curly=1
					ctx.bad_curly_locator=ctx.current_bracket_ac_ccnt_range[0]
				}
				ctx.PopBacStack()
			}else{
				break
			}
		}
	})
	this.AddEventHandler('BACKSPACE',function(){
		//left deletion: delete both ends
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccnt0=sel_new[0]
		var ccnt1=sel_new[1]
		if(ctx.current_bracket_ac_ccnt_range&&ccnt0==ccnt1&&ccnt1==ctx.current_bracket_ac_ccnt_range[0].ccnt+1){
			if(ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt){
				var ccnt_lbra=ccnt1-1
				this.HookedEdit([ccnt_lbra,2,null])
				this.CallOnChange()
				this.SetCaretTo(ccnt_lbra)
				ctx.PopBacStack()
				return 0
			}
		}
		return 1
	})
	this.AddEventHandler('RETURN RETURN2',function(){
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel_new=this.GetSelection()
		var ccnt0=sel_new[0]
		var ccnt1=sel_new[1]
		if(ccnt0==ccnt1&&ctx.current_bracket_ac_ccnt_range&&ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt){
			//pop everything and move past them before entering
			var lang=this.plugin_language_desc
			for(;ctx.current_bracket_ac_ccnt_range&&ccnt1+1==ctx.current_bracket_ac_ccnt_range[1].ccnt;){
				//{} case - don't pop it, also {} vs python
				if(ctx.current_bracket_ac=='}'&&!lang.curly_bracket_is_not_special){
					break;
				}
				var ccnt1=ctx.current_bracket_ac_ccnt_range[1].ccnt
				ctx.PopBacStack()
			}
			if(this.IsLineEndAt(ccnt1)){
				//only move if we're at the line end
				this.SetCaretTo(ccnt1)
				//go ahead and do it
				return 1
			}
		}
		return 1
	})
	var f_key_test=function(C){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var ctx=this.m_bracket_ctx;
		var sel=this.GetSelection();
		if(C=="{"||C=="["||C=="("||//normal brackets
			((//quote-likes
				C=="'"&&!lang.is_tex_like||
				C=='$'&&lang.is_tex_like||
				C=="\""||
				C=="`"&&lang.has_backquote_string
			)&&C!=ctx.current_bracket_ac//they don't self-nest
			&&sel[0]==sel[1])//they are not appropriate when overwriting things
		){
			var chbac=MatchingBracket(C)
			var ccnt_pos=this.sel1.ccnt
			var ch_neibs=ed.GetUtf8CharNeighborhood(ccnt_pos)
			var chprev=ch_neibs[0]
			var chnext=ch_neibs[1]
			if(chbac){
				if(this.IsLeftBracket(C.charCodeAt(0))&&chbac!="'"&&chbac!="\""&&chbac!="`"&&chbac!="$"){
					//the syntax has to actually consider it as a bracket, or it has to be a quote-like
					chbac=0;
				}else if(!this.IsBracketEnabledAt(ccnt_pos)){
					//the state has to allow brackets
					chbac=0
				}else if(chbac=='}'&&!lang.curly_bracket_is_not_special){
					//{ before indented line
					var indent_cur_line=this.GetIndentLevel(ccnt_pos);
					var lineno=this.GetLC(ccnt_pos)[0]
					var ccnt_lh_next=this.SeekLC(lineno+1,0)
					var indent_next_line=this.GetIndentLevel(ed.MoveToBoundary(ccnt_lh_next,1,"space"));
					if(indent_cur_line<indent_next_line){
						chbac=0;
					}
				}else if(C==chbac&&chprev==C.charCodeAt(0)){
					//typing two quotes in the middle of a string, do not AC
					chbac=0;
				}
			}
			if(chbac==C){
				//for self-matching things, we need to take space/non-space neighbors as a hint
				//do not auto-match when the next char is a word-char
				//also deny ' in tex when the *previous* char is a word-char
				if(UI.IsWordChar(chnext)||UI.IsWordChar(chprev)){
					chbac=0;
				}
			}
			if(C=='$'&&lang.is_tex_like){
				//no $$ if already in LaTeX math
				var state_id=this.ed.GetStateAt(this.ed.m_handler_registration["colorer"],ccnt_pos,"ill")[0];
				if(state_id==2){
					chbac=0;
				}
			}
			if(chbac){
				//other-half-mismatch test
				var is_lineend=this.IsLineEndAt(ccnt_pos)
				var is_manual_match=0
				if(ctx.bac_stack.length){
					//only the topmost level should check for the match
					is_manual_match=0
				}else if(chbac=='}'&&!lang.indent_as_parenthesis){
					is_manual_match=0;
				}else{
					var blevel=this.GetBracketLevel(ccnt_pos)
					var ccnt_rbra=this.FindBracket(blevel-1,ccnt_pos,1)
					is_manual_match=(ccnt_rbra>=0&&ed.GetUtf8CharNeighborhood(ccnt_rbra)[1]==chbac)
				}
				//smarter auto (): clearly fcall-ish case
				var ccnt_next_nonspace=ed.MoveToBoundary(ccnt_pos,1,"space")
				var chnext_nonspace=String.fromCharCode(ed.GetUtf8CharNeighborhood(ccnt_next_nonspace)[1])
				var is_fcall_like=0
				//previous-char whitelist for ([{
				if('+-*/|&^%<>.?:,;\r\n)]}'.indexOf(chnext_nonspace)>=0&&chnext_nonspace!=C&&UI.IsWordChar(chprev)&&this.m_user_just_typed_char){
					//after-id-and-before-sym-case, and the id is just typed, most likely a func call or sth
					is_fcall_like=1
					//avoid ++ --
					if(chnext_nonspace=='+'||chnext_nonspace=='-'){
						if(ed.GetUtf8CharNeighborhood(ccnt_next_nonspace+1)[1]==chnext_nonspace){
							is_fcall_like=0
						}
					}
					//avoid * & in C
					if(lang.has_pointer_ops&&(chnext_nonspace=='*'||chnext_nonspace=='&')){
						is_fcall_like=0
					}
					//avoid . in BSGP/SPAP
					if(lang.has_dlist_type&&chnext_nonspace=='.'){
						is_fcall_like=0
					}
				}
				if((is_lineend||
				chbac==C&&!UI.IsWordChar(chnext)&&!UI.IsWordChar(chprev))&&'?:,;\r\n)]}'.indexOf(chnext_nonspace)>=0&&!is_manual_match||
				ctx.current_bracket_ac_ccnt_range&&ccnt_pos+1==ctx.current_bracket_ac_ccnt_range[1].ccnt||
				is_fcall_like){
					if(ctx.current_bracket_ac){
						ctx.bac_stack.push(ctx.current_bracket_ac_ccnt_range)
						ctx.bac_stack.push(ctx.current_bracket_ac_bralevel)
						ctx.bac_stack.push(ctx.current_bracket_ac)
					}
					//.just_typed_bra=0//for func hint purposes
					var str=C+chbac;
					var sel=this.GetSelection()
					ctx.current_bracket_ac=chbac
					ccnt_pos=sel[0]
					if(lang.is_tex_like){
						//\left completion
						if(C=="{"){
							if(ccnt_pos>=1&&ed.GetText(ccnt_pos-1,1)=="\\"){
								str=C+"\\"+chbac;
							}
							if(ccnt_pos>=6&&ed.GetText(ccnt_pos-6,6)=="\\left\\"){
								str=C+"\\right\\"+chbac
							}
						}else{
							if(ccnt_pos>=5&&ed.GetText(ccnt_pos-5,5)=="\\left"){
								str=C+"\\right"+chbac
							}
						}
					}
					this.HookedEdit([sel[0],sel[1]-sel[0],str])
					this.CallOnChange()
					//only record the starting ccnt
					ctx.current_bracket_ac_ccnt_range=[ed.CreateLocator(ccnt_pos,-1), ed.CreateLocator(ccnt_pos+Duktape.__byte_length(str),1), ed.CreateLocator(ccnt_pos+Duktape.__byte_length(C),1)]
					//get the level AFTER insertion
					var ccnt_mid=ccnt_pos+Duktape.__byte_length(C)//len(str)-1
					ctx.current_bracket_ac_bralevel=this.GetBracketLevel(ccnt_mid)
					this.SetCaretTo(ccnt_mid)
					var hlobj=ed.CreateHighlight(ctx.current_bracket_ac_ccnt_range[2],ctx.current_bracket_ac_ccnt_range[1],-1)
					hlobj.color=this.color_completing_bracket;
					hlobj.invertible=0;
					ctx.current_bracket_ac_ccnt_range.push(hlobj)
					//ed.trigger_data.bracket_completed=C//tex \ref or \cite... don't need this
					ctx.detecting_bad_curly=0
					this.CallOnSelectionChange()
					this.UserTypedChar()
					return 0
				}
			}
			return 1
		}
		if(C==ctx.current_bracket_ac){
			var ccnt1=this.sel1.ccnt
			if(ccnt1+Duktape.__byte_length(C)==ctx.current_bracket_ac_ccnt_range[1].ccnt&&this.sel0.ccnt==ccnt1){
				this.HookedEdit([ccnt1,Duktape.__byte_length(C),C])
				this.SetCaretTo(ccnt1+Duktape.__byte_length(C))
				this.UserTypedChar()
				ctx.PopBacStack()
				this.CallOnChange()
				this.CallOnSelectionChange()
				return 0
			}
			return 1
		}
		return 1
	}
	var listening_keys=["{","[","(","'","\"","`","$",")","]","}"]
	for(var i=0;i<listening_keys.length;i++){
		var C=listening_keys[i];
		this.AddEventHandler(C,f_key_test.bind(this,C))
	}
}).prototype.desc={category:"Editing",name:"Auto-complete parenthesis",stable_name:"parenthesis_complete"};

//ignoring trailing spaces
UI.RegisterEditorPlugin(function(){
	this.AddEventHandler('END',function(){
		var ed_caret=this.GetCaretXY();
		var ccnt_lend=this.SeekXY(1e17,ed_caret.y);
		var ccnt_reend=this.GetEnhancedEnd(ccnt_lend)
		if(ccnt_reend<ccnt_lend&&this.sel1.ccnt!=ccnt_reend){
			//auto-strip the trailing space
			ccnt_lend=this.SeekLC(this.GetLC(ccnt_reend)[0],1e17)
			if(ccnt_lend>ccnt_reend&&this.ed.GetUtf8CharNeighborhood(ccnt_lend)[0]==13){
				ccnt_lend--;
			}
			if(ccnt_reend<ccnt_lend){
				this.HookedEdit([ccnt_reend,ccnt_lend-ccnt_reend,null])
				this.CallOnChange()
				this.SetCaretTo(ccnt_reend)
				return 0
			}
		}
		return 1
	})
	this.AddEventHandler('DELETE',function(){
		if(this.sel0.ccnt==this.sel1.ccnt){
			//auto-delete spaces before enter
			var ccnt=this.sel1.ccnt
			var ccnt_original=ccnt;
			var ccnt_after=this.ed.MoveToBoundary(ccnt,1,"space")
			if(ccnt<ccnt_after&&this.ed.GetUtf8CharNeighborhood(ccnt_after)[1]==10&&ccnt_after<this.ed.GetTextSize()){
				this.sel1.ccnt=ccnt_after+1
				ccnt=ccnt_after+1;
			}else{
				ccnt=this.sel1.ccnt+1;
			}
			if(ccnt>this.ed.GetTextSize()){return 0;}
			//auto-delete spaces after enter
			var ed=this.ed;
			if(this.plugin_class=="code_editor"&&this.m_is_main_editor){
				if(String.fromCharCode(ed.GetUtf8CharNeighborhood(ccnt)[0])=='\n'){
					if(ccnt_original>=this.GetEnhancedHome(ccnt_original)){
						this.sel1.ccnt=this.ed.MoveToBoundary(ccnt,1,"space")
					}
				}
			}
		}
		return 1
	})
}).prototype.desc={category:"Editing",name:"Auto-strip trailing spaces",stable_name:"trim_trailing_spaces"};

//hiding
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)&&!this.hyphenator){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({text:"Fo&ld",icon:"叠",context_menu_group:"fold",enable_hotkey:1,key:"ALT+LEFT",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				if(sel[0]==sel[1]){
					//bracket: end, ctrl+p
					//do bracket if possible
					var ccnt=sel[0]
					sel=this.GetSmartFoldRange(ccnt)
				}
				if(sel){
					renderer.HideRange(ed,sel[0],sel[1])
					this.SetSelection(
						renderer.SnapToShown(this.ed,this.sel0.ccnt,this.sel0.ccnt>=sel[1]?1:-1),
						renderer.SnapToShown(this.ed,this.sel1.ccnt,this.sel1.ccnt>=sel[1]?1:-1))
					this.CallOnSelectionChange();
					UI.Refresh()
				}
			}.bind(this)})
			menu_edit.AddNormalItem({text:"U&nfold",icon:"展",context_menu_group:"fold",enable_hotkey:1,key:"ALT+RIGHT",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				if(sel[0]==sel[1]){
					var ccnt=sel[0]
					var line=this.GetLC(ccnt)[0]
					var ccnt_l0=this.SeekLC(line,0)
					var ccnt_outer0=this.FindOuterBracket(ccnt,-1)
					if(ccnt_outer0>=ccnt_l0){
						//found bracket on the line
						var ccnt_outer1=this.FindOuterBracket(ccnt,1)
						if(ccnt_outer1>ccnt_outer0){
							sel=[ccnt_l0,ccnt_outer1]
						}
					}else{
						var id_indent=ed.m_handler_registration["seeker_indentation"]
						var my_level=this.GetIndentLevel(ccnt);
						var ccnt_l1=this.SeekLC(line+1)
						var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",ccnt_l1,1);
						if(ccnt_new>ccnt_l1){
							ccnt_new--
							if(ccnt_new>ccnt_l1){
								ccnt_new--
							}
							sel=[ccnt_l0,ccnt_new]
						}
					}
				}
				renderer.ShowRange(ed,sel[0],sel[1])
				this.CallOnSelectionChange();
				UI.Refresh()
			}.bind(this)})
			menu_edit=undefined;
		}
	})
	this.AddEventHandler('selectionChange',function(){
		var sel=this.GetSelection();
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		if(renderer.m_enable_wrapping>0){
			renderer.ShowRange(this.ed,sel[0]+1,sel[0]-1)
			renderer.ShowRange(this.ed,sel[1]+1,sel[1]-1)
		}
	})
})//.prototype.desc={category:"Controls",name:"Text folding",stable_name:"text_folding"};

//unicode
var ZeroPad=function(n,w){
	var s=n.toString();
	if(s.length<w){
		var a=[]
		for(var i=s.length;i<w;i++){
			a.push('0')
		}
		a.push(s)
		s=a.join("")
	}
	return s
}

var ApplyAutoEdit=function(doc,cur_autoedit_ops,line_id){
	var locs=doc.m_autoedit_locators;
	var ccnt0=locs[line_id+0].ccnt
	var ccnt1=locs[line_id+1].ccnt
	var ret=[]
	var ops_now=[];
	var delta=0;
	for(var i=0;i<cur_autoedit_ops.length;i+=3){
		var ccnt=cur_autoedit_ops[i];
		if(ccnt>=ccnt0&&ccnt<=ccnt1){
			var s=cur_autoedit_ops[i+2];
			var sz=cur_autoedit_ops[i+1];
			ops_now.push(cur_autoedit_ops[i],sz,s)
			delta-=sz;
			if(s){delta+=Duktape.__byte_length(s)}
		}else{
			ret.push(cur_autoedit_ops[i]+delta,cur_autoedit_ops[i+1],cur_autoedit_ops[i+2])
		}
	}
	if(ops_now.length>0){
		var ccnt=ops_now[ops_now.length-3]
		doc.SetSelection(ccnt,ccnt)
		doc.HookedEdit(ops_now);
		var s=ops_now[ops_now.length-1]
		if(s){
			var ccnt=doc.GetSelection()[0]
			doc.SetSelection(ccnt,ccnt+Duktape.__byte_length(s))
		}
		doc.CallOnChange();
		doc.CallOnSelectionChange();
	}
	//removed the processed edit ops
	return ret
}

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	var InvalidateAutoEdit=function(){
		if(this.m_autoedit_locators){
			var locs=this.m_autoedit_locators
			for(var i=0;i<locs.length;i++){
				locs[i].discard()
			}
			this.m_autoedit_locators=undefined
		}
		if(this.m_autoedit_range_highlight){
			this.m_autoedit_range_highlight.discard()
			this.m_autoedit_range_highlight=undefined
		}
		this.m_autoedit_example_line_id=undefined
		this.m_autoedit_context=undefined
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		renderer.m_tentative_editops=undefined
		renderer.ResetTentativeOps()
		//if(this.owner){this.owner.m_no_more_replace=0;}
	}
	this.InvalidateAutoEdit=InvalidateAutoEdit.bind(this);
	var StartAutoEdit=function(cclines,mode){
		var locs=[]
		this.m_autoedit_locators=locs;
		for(var i=0;i<cclines.length;i++){
			//create locators
			locs[i]=this.ed.CreateLocator(cclines[i],i&1?1:-1)
		}
		//render the stuff - gives some structural understanding
		if(mode=="explicit"){
			var hlobj=this.ed.CreateHighlight(
				locs[0],
				locs[locs.length-1],1)
			hlobj.color=this.color_auto_edit_range_highlight;
			hlobj.invertible=0;
			this.m_autoedit_range_highlight=hlobj;
		}
		this.m_autoedit_mode=mode
	}
	this.AddEventHandler('selectionChange',function(){
		if(this.is_in_vsel){return;}
		var ed=this.ed;
		var ln=this.GetLC(this.GetSelection()[0])[0]
		var ccnt_lh=this.SeekLC(ln,0)
		var renderer=ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		//still-in-range test
		if(this.m_autoedit_locators){
			var locs=this.m_autoedit_locators
			if(this.m_autoedit_mode=="explicit"&&!renderer.m_tentative_editops){
				//if(ccnt_lh>=locs[0].ccnt&&ccnt_lh<locs[locs.length-1].ccnt)
				//if(ccnt_lh==locs[0].ccnt){
				//	return;
				//}
				return;
			}else if(this.m_autoedit_example_line_id>=0){
				var line_id=this.m_autoedit_example_line_id;
				//if(ccnt_lh==locs[line_id+0].ccnt)
				if(ccnt_lh>=locs[line_id+0].ccnt&&ccnt_lh<locs[line_id+1].ccnt){
					return;
				}
			}else{
				//if(ccnt_lh>=locs[0].ccnt&&ccnt_lh<locs[1].ccnt)
				if(ccnt_lh==locs[0].ccnt){
					return;
				}
			}
		}
		this.m_detect_autoedit_at=ccnt_lh
		if(this.m_do_not_detect_autoedit_at!=undefined&&this.GetLC(this.sel1.ccnt)[0]!=this.m_do_not_detect_autoedit_at){
			this.m_do_not_detect_autoedit_at=undefined
		}
		//could allow multi-exampling this
		InvalidateAutoEdit.call(this)
	})
	this.AddEventHandler('beforeEdit',function(ops){
		this.m_autoedit_example_line_id=-1
		var ctx=this.m_autoedit_context
		if(!ctx&&this.m_detect_autoedit_at!=undefined&&this.m_detect_autoedit_at>=0&&this.m_detect_autoedit_at<=this.ed.GetTextSize()){
			for(var i=0;i<ops.length;i+=3){
				var s=ops[i+2];
				if(s&&s.indexOf('\n')>=0){
					//op with enter doesn't trigger AC
					return;
				}
			}
			if(this.m_do_not_detect_autoedit_at!=undefined&&this.GetLC(this.m_detect_autoedit_at)[0]==this.m_do_not_detect_autoedit_at){
				return;
			}
			ctx=UI.ED_AutoEdit_Detect(this.ed,this.m_detect_autoedit_at)
			if(ctx){
				this.m_autoedit_context=ctx
				StartAutoEdit.call(this,ctx.m_cclines,"auto")
				this.m_do_not_detect_autoedit_at=undefined
			}else{
				this.m_do_not_detect_autoedit_at=this.GetLC(this.m_detect_autoedit_at)[0];
			}
		}
		if(!ctx){return}
		var locs=this.m_autoedit_locators
		if(!locs){return}
		var ed=this.ed
		var sel=this.GetSelection()
		var line_id=-1;
		//the line(s) intersected by ops... multi-line edit should cancel it
		for(var i=0;i<locs.length;i+=2){
			if(locs[i+1].ccnt>=sel[1]){
				if(locs[i+0].ccnt<=sel[0]){
					line_id=i
					break
				}
			}
		}
		this.m_autoedit_example_line_id=line_id
		if(line_id<0){
			//invalidate
			InvalidateAutoEdit.call(this)
			return;
		}
	})
	this.AddEventHandler('change',function(){
		if(!(this.m_autoedit_example_line_id>=0)){
			return 1
		}
		if(this.owner&&this.owner.m_replace_context){return 1;}
		var ctx=this.m_autoedit_context
		if(!ctx){return}
		var locs=this.m_autoedit_locators
		var ed=this.ed
		var line_id=this.m_autoedit_example_line_id
		if(locs[line_id+1].ccnt-locs[line_id].ccnt>4096){return 1;}
		if(!UI.ED_AutoEdit_SetExample(ctx,line_id>>1,ed.GetText(locs[line_id].ccnt,locs[line_id+1].ccnt-locs[line_id].ccnt))){
			return 1;
		}
		var ops=UI.ED_AutoEdit_Evaluate(ctx,locs);
		//for(var i=0;i<locs.length;i+=2){
		//	print("============",i/2)
		//	print(ed.GetText(locs[i+0].ccnt,locs[i+1].ccnt-locs[i+0].ccnt))
		//}
		//print(ops)
		//highlight ops - fill out the overlay system
		var renderer=ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		this.m_hide_prev_next_buttons=0;
		renderer.m_tentative_editops=ops;
		renderer.ResetTentativeOps()
		UI.Refresh()
		return 1;
	})
	//CTRL+D - return 1, the other end should be a hook...? just compete and adjust the priority
	this.AddEventHandler('menu',function(){
		var ed=this.ed
		var renderer=ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		if(renderer.m_tentative_editops&&renderer.m_tentative_editops.length>0){
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			var ed_caret=this.GetIMECaretXY();
			var y_caret=(ed_caret.y-this.visible_scroll_y);
			var hc=UI.GetCharacterHeight(this.font)
			this.m_hide_prev_next_buttons=0;
			UI.DrawPrevNextAllButtons(this.owner,
				this.owner.x+this.m_rendering_w_line_numbers,this.owner.y+y_caret+hc*0.5, menu_edit,
				"Apply changes",["Apply to the previous line","Apply to all","Apply to the next line"],
				function(){
					var locs=this.m_autoedit_locators
					var sel=this.GetSelection()
					var line_id=-1;
					//the line(s) intersected by ops... multi-line edit should cancel it
					for(var i=0;i<locs.length;i+=2){
						if(locs[i+1].ccnt>=sel[1]){
							if(locs[i+0].ccnt<=sel[0]){
								line_id=i
								break
							}
						}
					}
					var cur_autoedit_ops=renderer.m_tentative_editops
					if(line_id>0){
						renderer.m_tentative_editops=ApplyAutoEdit(this,cur_autoedit_ops,line_id-2);
						renderer.ResetTentativeOps()
						if(!renderer.m_tentative_editops||!renderer.m_tentative_editops.length){
							InvalidateAutoEdit.call(this)
						}
					}
				}.bind(this),function(){
					var locs=this.m_autoedit_locators
					var sel=this.GetSelection()
					var line_id=-1;
					//the line(s) intersected by ops... multi-line edit should cancel it
					for(var i=0;i<locs.length;i+=2){
						if(locs[i+1].ccnt>=sel[1]){
							if(locs[i+0].ccnt<=sel[0]){
								line_id=i
								break
							}
						}
					}
					var cur_autoedit_ops=renderer.m_tentative_editops
					if(cur_autoedit_ops.length>0){
						var ccnt=cur_autoedit_ops[cur_autoedit_ops.length-3];
						this.SetSelection(ccnt,ccnt);
					}
					this.HookedEdit(cur_autoedit_ops);
					if(cur_autoedit_ops.length>0){
						var s=cur_autoedit_ops[cur_autoedit_ops.length-1]
						if(s){
							var ccnt=this.GetSelection()[0]
							this.SetSelection(ccnt,ccnt+Duktape.__byte_length(s))
						}
					}
					renderer.m_tentative_editops=undefined
					renderer.ResetTentativeOps()
					var tmp=this.m_autoedit_example_line_id;
					this.m_autoedit_example_line_id=-1;
					this.CallOnChange()
					this.m_autoedit_example_line_id=tmp;
					InvalidateAutoEdit.call(this)
				}.bind(this),function(){
					var locs=this.m_autoedit_locators
					var sel=this.GetSelection()
					var line_id=-1;
					//the line(s) intersected by ops... multi-line edit should cancel it
					for(var i=0;i<locs.length;i+=2){
						if(locs[i+1].ccnt>=sel[1]){
							if(locs[i+0].ccnt<=sel[0]){
								line_id=i
								break
							}
						}
					}
					var cur_autoedit_ops=renderer.m_tentative_editops
					if(line_id+2<locs.length){
						renderer.m_tentative_editops=ApplyAutoEdit(this,cur_autoedit_ops,line_id+2)
						renderer.ResetTentativeOps()
						if(!renderer.m_tentative_editops.length){
							InvalidateAutoEdit.call(this)
						}
					}
				}.bind(this))
			menu_edit=undefined;
		}
	})
	this.AddEventHandler('ESC',function(){
		InvalidateAutoEdit.call(this)
		return 1
	})
	///////////////
	var EnterVSel=(function(){
		if(this.is_in_vsel){
			//this.vsel_display_hl.color=this.bgcolor_selection;
			return;
		}
		this.is_in_vsel=1;
		//if(this.owner){this.owner.m_no_more_replace=1;}
		if(!this.vsel_sel0){
			this.vsel_sel0=this.ed.CreateLocator(this.sel1.ccnt,1)
			var hl_items=this.CreateTransientHighlight({
				'depth':0,
				'color':this.bgcolor_selection,
				'invertible':1,
			});
			//this.vsel_display_loc0=hl_items[0];
			//this.vsel_display_loc1=hl_items[1];
			//this.vsel_display_hl=hl_items[2]
		}
		//this.vsel_display_hl.color=this.bgcolor_selection
		this.vsel_sel0.ccnt=this.sel1.ccnt
		if(this.sel0.ccnt!=this.sel1.ccnt){
			this.sel0.ccnt=this.sel1.ccnt
		}
	}).bind(this)
	var UpdateVSel=(function(){
		if(this.owner){this.owner.m_no_more_replace=1}
		var ccnt0=this.vsel_sel0.ccnt
		var ccnt1=this.sel1.ccnt
		if(ccnt0>ccnt1){
			var tmp=ccnt0
			ccnt0=ccnt1
			ccnt1=tmp
		}
		var line0=this.GetLC(ccnt0)[0]
		var line1=this.GetLC(ccnt1)[0]
		//this.vsel_display_loc0.ccnt=this.SeekLC(line0,0)
		//this.vsel_display_loc1.ccnt=this.SeekLC(line1+1,0)
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+2);
		InvalidateAutoEdit.call(this)
		var ctx=UI.ED_AutoEdit_Start(this.ed,line_ccnts)
		this.m_autoedit_context=ctx
		if(this.owner){
			this.owner.DestroyReplacingContext();
		}
		if(ctx){
			StartAutoEdit.call(this,ctx.m_cclines,"explicit")
		}
	}).bind(this)
	this.AddEventHandler('selectionChange',function(){
		if(this.vsel_skip_sel_change){this.vsel_skip_sel_change=0;return 1;}
		if(!this.is_in_vsel){return 1;}//return 1 for "don't intercept"
		//leave vsel
		this.is_in_vsel=0;
		//this.vsel_display_loc0.ccnt=0
		//this.vsel_display_loc1.ccnt=0
		return 1;
	})
	this.AddEventHandler('change',function(){
		if(!this.is_in_vsel){return 1;}//return 1 for "don't intercept"
		//leave vsel
		this.is_in_vsel=0
		//this.vsel_display_loc0.ccnt=0
		//this.vsel_display_loc1.ccnt=0
		return 1;
	})
	this.AddEventHandler('ALT+SHIFT+UP',function(){
		EnterVSel();
		var ed_caret=this.GetCaretXY();
		var bk=this.x_updown;
		this.MoveCursorToXY(this.x_updown,ed_caret.y-1.0);
		this.x_updown=bk;
		this.sel0.ccnt=this.sel1.ccnt
		this.AutoScroll("show")
		this.vsel_skip_sel_change=1
		UpdateVSel();
	})
	this.AddEventHandler('ALT+SHIFT+DOWN',function(){
		EnterVSel();
		var hc=this.GetCharacterHeightAtCaret();
		var ed_caret=this.GetCaretXY();
		var bk=this.x_updown;
		this.MoveCursorToXY(this.x_updown,ed_caret.y+hc);
		this.x_updown=bk;
		this.sel0.ccnt=this.sel1.ccnt
		this.AutoScroll("show")
		this.vsel_skip_sel_change=1
		UpdateVSel();
	})
	//coulddo: menu items
}).prototype.desc={category:"Editing",name:"Automatic edit propagation",stable_name:"auto_edit"};

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('selectionChange',function(){
		UI.g_cursor_history_test_same_reason=0
	})
	this.AddEventHandler('change',function(){
		UI.g_cursor_history_undo=[];
		UI.g_cursor_history_redo=[];
		UI.g_cursor_history_test_same_reason=0;
	})
	var fnavigate=function(q0,q1){
		if(!q0.length){return 1;}
		var navitem=q0.pop()
		var prev_ccnt0=this.sel0.ccnt
		var prev_ccnt1=this.sel1.ccnt
		q1.push({file_name:this.m_file_name,ccnt0:prev_ccnt0,ccnt1:prev_ccnt1,sreason:"navigation"})
		UI.g_cursor_history_test_same_reason=0
		UI.OpenEditorWindow(navitem.file_name,function(){
			//print('nav',navitem.ccnt0,navitem.ccnt1,prev_ccnt0,prev_ccnt1)
			this.SetSelection(navitem.ccnt0,navitem.ccnt1)
			this.CallOnSelectionChange();
		})
	}
	var fprevhist=function(){
		return fnavigate.call(this,UI.g_cursor_history_undo,UI.g_cursor_history_redo)
	}
	var fnexthist=function(){
		return fnavigate.call(this,UI.g_cursor_history_redo,UI.g_cursor_history_undo)
	}
	this.AddEventHandler('CTRL+ALT+-',fprevhist)
	this.AddEventHandler('CTRL+ALT+=',fnexthist)
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var menu_search=UI.BigMenu("&Search")
			var doc=this;
			menu_search.AddSeparator();
			menu_search.AddButtonRow({text:"Navigate"},[
				{text:"navigate_back",icon:"左",tooltip:"Back - CTRL+ALT+MINUS",action:function(){
					fprevhist.call(doc)
				}},{text:"navigate_fwd",icon:"右",tooltip:"Forward - CTRL+ALT+PLUS",action:function(){
					//text:"&select to"
					fnexthist.call(doc)
				}}])
			if(UI.g_cursor_history_undo.length>0){
				UI.ToolButton("back",{tooltip:"Back - CTRL+ALT+MINUS",action:fprevhist.bind(doc)})
			}
			if(UI.g_cursor_history_redo.length>0){
				UI.ToolButton("fwd",{tooltip:"Forward - CTRL+ALT+PLUS",action:fnexthist.bind(doc)})
			}
		}
	})
})//.prototype.desc={category:"Controls",name:"Cursor history navigation",stable_name:"cursor_hist"};

var g_regexp_bash_escaping=new RegExp('[#;&"\'\\\\,`:!*?$(){}\\[\\]<|> \t]','g');
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	if(!UI.TestOption("auto_completion")){return;}
	//this.AddEventHandler('autoComplete',function(){
	this.AddEventHandler('explicitAutoComplete',function(){
		var lang=this.plugin_language_desc
		if(!lang){return;}
		//shell script only
		//||this.plugin_language_desc.parser=="C"&&!this.IsBracketEnabledAt(this.sel1.ccnt)
		if(!lang.shell_script_type){return;}
		var ccnt=this.sel1.ccnt;
		//followed by non-word
		var ch=this.ed.GetUtf8CharNeighborhood(ccnt)[1]
		if(UI.IsWordChar(ch)){return;}
		//shell script
		//line short enough
		var ccnt_lh=this.SeekLC(this.GetLC(ccnt)[0],0)
		if(!(ccnt-ccnt_lh<4096)){return;}
		//parse the line into a list of words, then work on the last word
		var s=this.ed.GetText(ccnt_lh,this.sel1.ccnt-ccnt_lh)
		var pword=-1,cur_str=[],instr=undefined;
		var args=[];
		var endWord=UI.HackCallback(function(i){
			if(pword<0){return;}
			args.push(cur_str.join(""))
			args.push(pword)
			args.push(i)
			pword=-1;
			cur_str=[];
		});
		for(var i=0;i<s.length;i++){
			var ch=s[i];
			if(!instr&&(ch==' '||ch=='\t')){
				endWord(i);
				continue;
			}
			if(pword<0){
				pword=i;
			}
			if(ch=='\\'&&lang.shell_script_type!="windows"){
				i++;
				if(i<s.length){cur_str.push(s[i]);}
				continue;
			}
			if(instr&&ch==instr){
				instr=undefined;
				//assert(pword>=0)
				endWord(i+1);
			}else if(ch=="'"&&lang.shell_script_type!="windows"||ch=='"'){
				instr=ch;
				pword=i;
			}else{
				cur_str.push(s[i]);
			}
		}
		endWord(s.length);
		if(args.length<3){return;}
		//work on args
		//todo: current path, executable-completion case
		var s_path=args[args.length-3];
		var s_path_std=s_path.replace(g_regexp_backslash,"/");
		var s_path_prefix="";
		if(!(s_path_std.indexOf('/')>=0)&&this.m_file_name){
			s_path_prefix=UI.GetPathFromFilename(this.m_file_name)+"/";
		}
		var find_context=IO.CreateEnumFileContext(s_path_prefix+s_path_std+"*",3)
		var cands=[];
		var need_quote=0;
		for(;;){
			var fnext=find_context()
			if(!fnext){
				find_context=undefined
				break
			}
			var sname=fnext.name
			if(s_path_prefix){
				sname=sname.substr(s_path_prefix.length);
			}
			//lang.shell_script_type=="windows"
			//if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
			//	sname=sname.toLowerCase()
			//}
			if(fnext.is_dir){
				sname=sname+"/"
			}
			if(sname.indexOf(' ')>=0||sname.indexOf('\t')>=0){
				need_quote=1;
			}
			if(lang.shell_script_type=="windows"){
				sname=sname.replace(g_regexp_slash,"\\")
			}
			cands.push(sname);
		}
		if(!cands.length){return;}
		var ret={cands:cands,s_prefix:s_path};
		var ccnt0=ccnt_lh+Duktape.__byte_length(s.slice(0,args[args.length-2]));
		if(need_quote||this.sel1.ccnt-ccnt0!=Duktape.__byte_length(s_path)){
			for(var i=0;i<cands.length;i++){
				cands[i]='"'+cands[i]+'"';
			}
			ret.ccnt0=ccnt0;
		}
		//todo: call bash completion on *nix
		//http://stackoverflow.com/questions/3520936/accessing-bash-completions-for-specific-commands-programmatically
		return UI.ED_PrepareACCands(ret);
	})
})//.prototype.name="File name completion";

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('change',function(){
		if(!this.m_diff_from_save||!this.owner||!(this.owner.h_obj_area>0)){return;}
		this.m_diff_minimap=UI.ED_CreateDiffTrackerBitmap(this.ed,this.m_diff_from_save,this.owner.h_obj_area*UI.pixels_per_unit);
		this.m_diff_minimap_h_obj_area=this.owner.h_obj_area
	})
}).prototype.desc={category:"Display",name:"Show changed lines in scrollbar",stable_name:"changed_lines"};

var fsmart_replace=function(s_regexp,fcallback){
	var sel=this.GetSelection();
	var ccnt0=sel[0];
	var ccnt1=sel[1];
	if(!(ccnt0<ccnt1)){
		ccnt0=0
		ccnt1=this.ed.GetTextSize()
	}
	this.SmartReplace(ccnt0,ccnt1,s_regexp,fcallback);
}

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		if(!UI.HasFocus(this)){return;}
		var menu_convert=UI.BigMenu("Con&vert")
		var tab_width=UI.GetOption("tab_width",4);
		//var s_tab_space=Array(tab_width+1).join(' ');
		menu_convert.AddNormalItem({icon:"空",text:"Leading &tabs to spaces",action:
			fsmart_replace.bind(this,"^[ \t]+",function(smatch){
				//return Array(smatch.length+1).join(s_tab_space);
				return UI.ED_NativeToSpace(smatch,tab_width)
			})})
		menu_convert.AddNormalItem({icon:"表",text:"Leading &spaces to tabs",action:
			//("+s_tab_space+")
			fsmart_replace.bind(this,"^[ \t]+",function(smatch){
				//return Array((((smatch.length+tab_width-1)/tab_width)|0)+1).join('\t');
				return UI.ED_NativeToTab(smatch,tab_width)
			})})
		menu_convert.AddNormalItem({text:"Letters to &UPPERCASE",action:
			fsmart_replace.bind(this,".+",function(smatch){
				return smatch.toUpperCase();
			})})
		menu_convert.AddNormalItem({text:"Letters to &lowercase",action:
			fsmart_replace.bind(this,".+",function(smatch){
				return smatch.toLowerCase();
			})})
		menu_convert.AddNormalItem({text:"Line endings to &DOS",action:
			fsmart_replace.bind(this,"\r*\n",function(smatch){
				return "\r\n"
			})})
		menu_convert.AddNormalItem({text:"Line endings to Uni&x",action:
			fsmart_replace.bind(this,"\r+\n",function(smatch){
				return "\n";
			})})
		menu_convert.AddSeparator();
		var sel=this.GetSelection();
		if(sel[0]<sel[1]){
			menu_convert.AddNormalItem({text:"Wide char ↔ \\u",icon:"Ｕ",enable_hotkey:1,key:"SHIFT+CTRL+U",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				if(sel[0]<sel[1]){
					var s0=ed.GetText(sel[0],sel[1]-sel[0])
					var n=s0.length;
					var nnxt=0
					var surrogate_high=0
					var sret=[]
					for(var i=0;i<n;i++){
						var ch=s0.charCodeAt(i)
						if(ch>=128){
							//add \u
							if(ch>=65536){
								ch=ch-0x10000
								var chx=0xd800+((ch>>10)&0x3ff)
								sret.push("\\u"+ZeroPad(chx.toString(16),4))
								ch=ch&0x3ff
								ch=ch+0xdc00
							}
							sret.push("\\u"+ZeroPad(ch.toString(16),4))
						}else{
							if(ch==0x5C&&i<n-1&&s0[i+1]=='u'){
								//enter \u mode
								ch=parseInt(s0.substr(i+2,4),16)
								sret.push(String.fromCharCode(ch))
								//var surrogate_high=0;
								//if(ch>=0xd800&&ch<=0xdc00){
								//	surrogate_high=(ch&0x3ff)
								//}else{
								//	if(ch>=0xdc00&&ch<=0xe000){
								//		ch=(surrogate_high<<10)+(ch&0x3ff)+0x10000
								//		surrogate_high=0
								//	}
								//}
								i=i+5
								continue
							}
							sret.push(String.fromCharCode(ch))
						}
					}
					var ssret=sret.join("")
					this.HookedEdit([sel[0],sel[1]-sel[0],ssret])
					this.SetSelection(sel[0],sel[0]+Duktape.__byte_length(ssret))
					this.CallOnChange()
					this.AutoScroll("show")
					UI.Refresh()
				}
			}.bind(this)})
		}
		menu_convert.AddNormalItem({text:"Escape C string",action:
			fsmart_replace.bind(this,"[\\x00-\\xff]*",function(smatch){
				var sret=JSON.stringify(smatch);
				return sret.substr(1,sret.length-2);
			})})
		menu_convert.AddNormalItem({text:"Escape URL query string",action:
			fsmart_replace.bind(this,"[\\x00-\\xff]*",function(smatch){
				return encodeURIComponent(smatch);
			})})
		menu_convert.AddNormalItem({text:"Unescape URL query string",action:
			fsmart_replace.bind(this,"[\\x00-\\xff]*",function(smatch){
				return decodeURIComponent(smatch);
			})})
		menu_convert=undefined;
	})
})

//code tagging
//var CODE_TAG_LENGTH=12;
var CreateFileTag=function(){
	//return IO.SHA1([UI.g_git_email,Date.now()].join('&')).substr(0,CODE_TAG_LENGTH);
	return [UI.g_git_name,UI.g_git_email,(new Date()).toISOString()].join('_').replace(/[\-: ]/g,'_');
};

if(!UI.m_ui_metadata["<tag_cache>"]){
	UI.m_ui_metadata["<tag_cache>"]={};
}
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		if(!UI.HasFocus(this)){return;}
		var sel=this.GetSelection();
		var menu_tools=UI.BigMenu("&Tools")
		if(sel[0]<sel[1]){
			menu_tools.AddSeparator();
			menu_tools.AddNormalItem({text:"Tag the code &block",enable_hotkey:1,key:"CTRL+B",action:function(){
				var stag=CreateFileTag();
				var sel=this.GetSelection();
				var line0=this.GetLC(sel[0])[0];
				var line1=this.GetLC(sel[1])[0];
				if(this.SeekLC(line1,0)<sel[1]){line1++;}
				sel[0]=this.SeekLC(line0,0);
				sel[1]=this.SeekLC(line1,0);
				var sindent0=this.ed.GetText(sel[0],CountSpacesAfter(this.ed,sel[0]));
				var sindent1=sindent0;//this.ed.GetText(sel[1],CountSpacesAfter(this.ed,sel[1]));
				var lang=this.plugin_language_desc
				var cmt_holder=lang;
				if(lang.GetCommentStrings){
					cmt_holder=lang.GetCommentStrings(this.ed.GetStateAt(this.ed.m_handler_registration["colorer"],sel[0],"ill")[0]);
				}
				var s_line_comment=cmt_holder.line_comment||'//';
				this.HookedEdit([
					sel[0],0,sindent0+s_line_comment+'#b+'+stag+'\n',
					sel[1],0,sindent1+s_line_comment+'#b-'+stag+'\n']);
				this.SetSelection(sel[0],this.SeekLC(line1+2,0))
				UI.SDL_SetClipboardText(['\n![](qtag://',stag,')\n\n'].join(''));
				UI.m_ui_metadata["<tag_cache>"][stag]=this.m_file_name;
				UI.Refresh();
			}.bind(this)});
		}
		menu_tools=undefined;
	})
});

//markdown
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor||this.notebook_owner){return;}
	this.AddEventHandler('global_menu',function(){
		var desc=this.plugin_language_desc;
		if(desc.name!='Markdown'){return;}
		var menu_run=UI.BigMenu("&Run")
		if(this.m_is_help_page_preview){
			menu_run.AddNormalItem({text:"View source (&R)...",key:"F5",enable_hotkey:1,action:function(){
				this.m_is_help_page_preview=0;
			}.bind(this)});
		}else{
			menu_run.AddNormalItem({text:"View formatted (&R)...",key:"F5",enable_hotkey:1,action:function(){
				this.m_is_help_page_preview=1;
			}.bind(this)});
		}
		menu_run=undefined;
	})
});

//QInfo
if(UI.ENABLE_EXPERIMENTAL_FEATURES){
	UI.BuildComboGraph=function(parsed_combos){
		//ret.matched
		//ret.edges
		//combo to graph: we should render it on top of the current editor tab - it's temporary
		//console.log(JSON.stringify(parsed_combos));
		//need to compute a layout - sort by ccnt for y, nested level for x
		ret.matched.push({
			__id__:"<root>",
		})
	};
	UI.RegisterEditorPlugin(function(){
		if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
		this.AddEventHandler('global_menu',function(){
			var menu_tools=UI.BigMenu("&Tools")
			menu_tools.AddNormalItem({text:"Debug: Query QInfo (&E)...",key:"CTRL+E",enable_hotkey:1,action:function(){
				//coulddo: size-limiting
				var ret=UI.ED_QueryQInfo(this,0,this.sel1.ccnt);
				var cands=[];
				var BIG_WEIGHT=1048576;
				for(var i=0;i<ret.objs.length;i++){
					if(!ret.objs[i].id!='~'){
						cands.push({name:ret.objs[i].id,weight:BIG_WEIGHT,brief:ret.objs[i].brief});
					}
				}
				for(var i=0;i<ret.funcs.length;i++){
					cands.push({name:ret.funcs[i].id,weight:BIG_WEIGHT,brief:ret.funcs[i].brief});
				}
				if(cands.length){
					this.StartACWithCandidates(cands);
				}
			}.bind(this)});
			menu_tools.AddNormalItem({text:"Debug: parse combo...",key:"SHIFT+CTRL+E",enable_hotkey:1,action:function(){
				var ret=UI.ED_ParseAsCombo(this,0,this.ed.GetTextSize());
				UI.BuildComboGraph(ret);
			}.bind(this)});
			menu_tools=undefined;
		})
	});
}
