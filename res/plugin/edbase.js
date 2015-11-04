var UI=require("gui2d/ui");
var W=require("gui2d/widgets");
var Language=require("res/lib/langdef");

Language.Register({
	name_sort_hack:" Plain Text",name:"Plain text",parser:"text",
	rules:function(lang){
		lang.DefineDefaultColor("color")
		return function(){}
	}
})

var f_C_like=function(lang,keywords,has_preprocessor){
	lang.DefineDefaultColor("color_symbol")
	var bid_preprocessor
	if(has_preprocessor){
		bid_preprocessor=lang.ColoredDelimiter("key","#","\n","color_meta");
	}else{
		bid_preprocessor=bid_comment;
	}
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
	return (function(lang){
		if(has_preprocessor){
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2,bid_preprocessor]);
			if(lang.isInside(bid_preprocessor)){
				lang.Enable(bid_comment);
				//lang.Enable(bid_comment2);
			}
		}else{
			lang.SetExclusive([bid_comment,bid_comment2,bid_string,bid_string2]);
		}
		if(lang.isInside(bid_comment)||lang.isInside(bid_comment2)||lang.isInside(bid_string)||lang.isInside(bid_string2)||has_preprocessor&&lang.isInside(bid_preprocessor)){
			lang.Disable(bid_bracket);
		}else{
			lang.Enable(bid_bracket);
		}
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

Language.Register({
	name:"C/C++",parser:"C",
	extensions:["c","cxx","cpp","cc","h","hpp"],
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1,'class':2,'struct':2,'union':2,'namespace':2},
	has_pointer_ops:1,
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			keyword:['__asm','__declspec','if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','using'],
			type:['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t']
		},1)
	},
	include_paths:ProcessIncludePaths(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"?[
		"%INCLUDE%",
		"%VS120COMNTOOLS%../../VC/include",
		"%VS110COMNTOOLS%../../VC/include",
		"%VS100COMNTOOLS%../../VC/include",
		"%VS90COMNTOOLS%../../VC/include",
		"%VS80COMNTOOLS%../../VC/include",
		"%VS120COMNTOOLS%../../../Windows Kits/8.0/Include/um",
		"%VS120COMNTOOLS%../../../Windows Kits/8.0/Include/shared",
		"%VS120COMNTOOLS%../../../Windows Kits/8.0/Include/winrt",
		"%VS110COMNTOOLS%../../../Windows Kits/8.0/Include/um",
		"%VS110COMNTOOLS%../../../Windows Kits/8.0/Include/shared",
		"%VS110COMNTOOLS%../../../Windows Kits/8.0/Include/winrt",
		"%VS90COMNTOOLS%../../../Microsoft SDKs/Windows/v5.0/Include",
		"c:/mingw/include"
	]:[
		"${INCLUDE}",
		"/usr/include",
		"/usr/local/include",
		//todo: mac paths
	])
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
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['enum','if','else','elif','switch','case','default','break','continue','return','for','const','struct','class','function','sizeof','new','delete','import','export','typedef','inline','__inline_loop_body','operator','foreach','in','this','module','true','false','while'],
			'type':['void','char','short','int','long','iptr','uptr','auto','byte','ushort','uint','ulong','i8','i16','i32','i64','u8','u16','u32','u64','f32','f64','float','double','string','Object','Interface','typename','typeof'],
		},0)
	},
	include_paths:['c:/tp/pure/units']
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
			'type':['volatile','byte','long','char','boolean','double','float','int','short','void'],
		},0)
	}
});

Language.Register({
	name:'BSGP',parser:"C",
	extensions:['i'],
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
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1,'class':2,'struct':2,'union':2,'namespace':2,'__global__':1,'__device__':1,'__host__':1},
	has_pointer_ops:1,
	file_icon_color:0xff9a3d6a,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['if','else','switch','case','default','break','continue','goto','return','for','while','do','const','static','try','catch','finally','throw','volatile','virtual','friend','public','private','protected','struct','union','class','sizeof','new','delete','import','export','typedef','inline','namespace','private','protected','public','operator','friend','mutable','enum','template','this','extern','__stdcall','__cdecl','__fastcall','__thiscall','true','false','__global__','__device__','__host__'],
			'type':['void','char','short','int','long','auto','unsigned','signed','register','float','double','bool','const_cast','dynamic_cast','reinterpret_cast','typename','wchar_t'],
		},1)
	}
});

Language.Register({
	name:'Javascript',parser:"C",
	auto_curly_words:{'if':1,'for':1,'while':1,'switch':1,'do':1,'try':1},
	extensions:['js','json'],
	file_icon_color:0xffb4771f,
	file_icon:'プ',
	rules:function(lang){
		return f_C_like(lang,{
			'keyword':['break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super','undefined'],
			'type':['typeof','var','void','boolean','byte','int','short','char','double','long','float'],
		},1)
	}
});

Language.Register({
	name:'HTML',parser:"text",
	extensions:['htm','html'],
	file_icon_color:0xff444444,
	file_icon:'マ',
	rules:function(lang,keywords,has_preprocessor){
		lang.DefineDefaultColor("color_symbol")
		var bid_tag=lang.DefineDelimiter("key","<",">");
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_script=lang.ColoredDelimiter("key","<script","</script>","color_symbol2");
		var bid_js_comment=lang.ColoredDelimiter("key","/*","*/","color_comment");
		var bid_js_comment2=lang.ColoredDelimiter("key","//","\n","color_comment");
		var bid_string=lang.ColoredDelimiter("key",'"','"',"color_string");
		var bid_string2=lang.ColoredDelimiter("key","'","'","color_string");
		var bid_js_bracket=lang.DefineDelimiter("nested",['(','[','{'],['}',']',')']);
		lang.DefineToken("&amp;")
		lang.DefineToken("&apos;")
		lang.DefineToken('&quot;')
		lang.DefineToken('&lt;')
		lang.DefineToken('&gt;')
		lang.DefineToken('\\/')
		var kwset=lang.DefineKeywordSet("color_symbol",['<','/']);
		kwset.DefineKeywords("color_keyword",["DOCTYPE","a","abbr","acronym","address","applet","area","article","aside","audio","b","base","basefont","bdi","bdo","big","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","datalist","dd","del","details","dfn","dialog","dir","div","dl","dt","em","embed","fieldset","figcaption","figure","font","footer","form","frame","frameset","h1","head","header","hr","html","i","iframe","img","input","ins","kbd","keygen","label","legend","li","link","main","map","mark","menu","menuitem","meta","meter","nav","noframes","noscript","object","ol","optgroup","option","output","p","param","pre","progress","q","rp","rt","ruby","s","samp","script","section","select","small","source","span","strike","strong","style","sub","summary","sup","table","tbody","td","textarea","tfoot","th","thead","time","title","tr","track","tt","u","ul","var","video","wbr"])
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol");
		kwset.DefineWordColor("color")
		kwset=lang.DefineKeywordSet("color_symbol2");
		kwset.DefineKeywords("color_keyword",[
			'script',
			'break','export','return','case','for','switch','comment','function','this','continue','if','default','import','delete','in','do','label','while','else','new','with','abstract','implements','protected','instanceOf','public','interface','static','synchronized','false','native','throws','final','null','transient','package','true','goto','private','catch','enum','throw','class','extends','try','const','finally','debugger','super','window','document'])
		kwset.DefineKeywords("color_type",['typeof','var','void','boolean','byte','int','short','char','double','long','float'])
		kwset.DefineWordColor("color2")
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
	name:'XML',parser:"text",
	extensions:['xml','vcproj','vcxproj','sproj','sln'],
	file_icon_color:0xff444444,
	file_icon:'マ',
	rules:function(lang){
		lang.DefineDefaultColor("color_symbol")
		lang.DefineToken('<')//short tokens must come first
		var bid_comment=lang.ColoredDelimiter("key","<!--","-->","color_comment");
		var bid_cdata=lang.ColoredDelimiter("key","<![CDATA[","]]>","color_symbol2");
		var bid_header=lang.ColoredDelimiter("key","<?","?>","color_meta");
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
			lang.SetExclusive([bid_comment,bid_cdata,bid_header,bid_string,bid_string2]);
			if(lang.isInside(bid_comment)||lang.isInside(bid_cdata)||lang.isInside(bid_header)||lang.isInside(bid_string)||lang.isInside(bid_string2)){
				lang.Disable(bid_bracket);
			}else{
				lang.Enable(bid_bracket);
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
		return f_shell_like(lang,{
			'keyword':['if','exists','not','goto','for','do'],
		})
	}
});

var f_tex_like=function(lang){
	lang.DefineDefaultColor("color_symbol")
	var bid_comment=lang.ColoredDelimiter("key","%","\n","color_comment");
	var bid_math=lang.ColoredDelimiter("key","$","$","color_string");
	var bid_bracket=lang.DefineDelimiter("nested",['\\begin','{'],['}','\\end']);
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
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xffb4771f,
	file_icon:'テ',
	rules:f_tex_like
});

Language.Register({
	name:'TeX bibliography',extensions:['bib'],
	curly_bracket_is_not_special:1,is_tex_like:1,
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xff2ca033,
	file_icon:'テ',
	rules:f_tex_like
});

Language.Register({
	name_sort_hack:" Markdown",name:'Markdown',extensions:['md','markdown'],
	curly_bracket_is_not_special:1,
	default_hyphenator_name:"en_us",
	spell_checker:"en_us",
	file_icon_color:0xff444444,
	file_icon:'文',
	rules:function(lang){
		lang.DefineDefaultColor("color")
		var bid_title=lang.ColoredDelimiter("key","#","\n","color_type");
		lang.SetSpellCheckedColor("color")
		/////////////
		return (function(lang){
			//nothing
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
var g_compiler_by_ext={}
var CompilerDone=function(){UI.already_compiling=0}
Language.RegisterCompiler=function(s_exts,obj){
	for(var i=0;i<s_exts.length;i++){
		var s_ext_lower=s_exts[i].toLowerCase()
		var ret=g_compiler_by_ext[s_ext_lower]
		if(!ret){
			ret={m_hash:{},m_array:[]}
			g_compiler_by_ext[s_ext_lower]=ret
		}
		ret.m_array.push(obj)
		ret.m_hash[obj.name]=obj
	}
	if(!obj.make){
		obj.make=function(doc,run_it){
			UI.already_compiling=1
			UI.CallPMJS("make",this.GetDesc(doc), doc,this.ParseOutput.bind(this),
				run_it?function(code){
					if(code==0){
						UI.CallPMJS("run",this.GetDesc(doc), doc,this.ParseOutput.bind(this),CompilerDone)
					}
				}.bind(this):CompilerDone)
		};
	}
	return obj
}

var GetCompiler=function(doc){
	if(!doc.m_file_name){return undefined}
	var s_ext=UI.GetFileNameExtension(doc.m_file_name)
	if(!s_ext){return undefined}
	var compilers=g_compiler_by_ext[s_ext.toLowerCase()]
	if(!compilers){return undefined}
	if(doc.m_compiler_name){
		return compilers.m_hash[doc.m_compiler_name];
	}else{
		doc.m_compiler_name=compilers.m_array[0].name
		return compilers.m_array[0]
	}
}
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	UI.RegisterCodeEditorPersistentMember("m_compiler_name")
	this.AddEventHandler('selectionChange',function(){
		this.owner.DismissNotification("double_compilation")
	})
	this.AddEventHandler('menu',function(){
		var compiler=GetCompiler(this)
		if(!compiler){return 1}
		var menu_run=UI.BigMenu("&Run")
		var doc=this
		menu_run.AddNormalItem({text:"&Compile",enable_hotkey:1,key:"F7",action:function(){
			if(UI.already_compiling){
				doc.owner.CreateNotification({
					id:"double_compilation",icon:'警',
					text:"Already compiling something else",
				})
				return;
			}
			if(!UI.top.app.document_area.SaveAll()){return;}
			doc.owner.m_sxs_visualizer=W.SXS_BuildOutput
			UI.ClearCompilerErrors()
			compiler.make(doc,0)
		}})
		menu_run.AddNormalItem({text:"&Run",enable_hotkey:1,key:"CTRL+F5",action:function(){
			if(UI.already_compiling){
				doc.owner.CreateNotification({
					id:"double_compilation",icon:'警',
					text:"Already compiling something else",
				})
				return;
			}
			if(!UI.top.app.document_area.SaveAll()){return;}
			doc.owner.m_sxs_visualizer=W.SXS_BuildOutput
			UI.ClearCompilerErrors()
			compiler.make(doc,1)
		}})
	})
}).prototype.name="Compilation";

IO.AsyncShell=function(cmdline){
	if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
		IO.Shell(["start"," ","/b"].concat(cmdline))
	}else{
		IO.Shell(cmdline.concat(["&"]))
	}
}

UI.WriteBuildOutput=function(fparse,s){
	if(!UI.g_build_output_editor){
		var obj=Object.create(W.CodeEditor_prototype)
		var style=UI.default_styles.sxs_build_output.editor_style
		obj.style=style
		for(var attr in style){
			obj[attr]=style[attr]
		}
		obj.w=9999;obj.h=9999//for initial scrolling
		obj.m_clickable_ranges=[]
		obj.plugins=[function(){
			var fselchange=function(do_onfocus){
				var sel=this.GetSelection()
				var l=0;
				var r=this.m_clickable_ranges.length-1;
				while(l<=r){
					var m=(l+r)>>1;
					if(this.m_clickable_ranges[m].loc0.ccnt<=sel[0]){
						l=m+1
					}else{
						r=m-1
					}
				}
				if(r>=0&&this.m_clickable_ranges[r].loc0.ccnt<=sel[0]&&sel[1]<=this.m_clickable_ranges[r].loc1.ccnt){
					//yes, it's clickable
					var crange=this.m_clickable_ranges[r]
					crange.f.call(this,do_onfocus,crange.loc0.ccnt,crange.loc1.ccnt)
					return 1
				}
				return 0
			};
			this.AddEventHandler('selectionChange',function(){fselchange.call(this,0);})
			this.AddEventHandler('doubleClick',function(){
				fselchange.call(this,1);
			})
			this.AddEventHandler('ESC',function(){
				var sztext=this.ed.GetTextSize()
				if(sztext){
					this.ed.Edit([0,sztext,undefined])
					this.SetSelection(0,0)
				}
				for(var i=0;i<this.m_clickable_ranges.length;i++){
					var crange=this.m_clickable_ranges[i];
					crange.loc0.discard()
					crange.loc1.discard()
					crange.hlobj.discard()
				}
				this.m_clickable_ranges=[]
				UI.ClearCompilerErrors()
			})
		}];
		obj.language=Language.GetDefinitionByName("Plain text")
		obj.Init()
		UI.g_build_output_editor=obj
	}
	var obj=UI.g_build_output_editor;
	var ccnt=obj.ed.GetTextSize()
	var sel=obj.GetSelection()
	obj.ed.Edit([ccnt,0,s])//hookededit discards: it's read_only
	if(sel[1]==ccnt&&sel[0]==ccnt){
		var ccnt_end=obj.ed.GetTextSize()
		obj.SetSelection(ccnt_end,ccnt_end)
	}
	//do the parsing
	var line=obj.GetLC(ccnt)[0]
	var ccnt_lh=obj.SeekLC(line,0)
	var ccnt_tot=obj.ed.GetTextSize()
	for(;;){
		var ccnt_next=obj.SeekLineBelowKnownPosition(ccnt_lh,line,line+1)
		if(!(ccnt_next<ccnt_tot)){
			if(!(obj.GetLC(ccnt_next)[0]>line)){break;}
		}
		var fclick_callback=undefined
		try{
			fclick_callback=fparse(obj.ed.GetText(ccnt_lh,ccnt_next-ccnt_lh))
		}catch(err){}
		if(fclick_callback){
			//print("*** ",fclick_callback,' ',obj.ed.GetText(ccnt_lh,ccnt_next-ccnt_lh))
			UI.got_any_error_this_run=1
			var loc0=obj.ed.CreateLocator(ccnt_lh,1)
			var loc1=obj.ed.CreateLocator(ccnt_next,-1)
			var hlobj=obj.ed.CreateHighlight(loc0,loc1,-1)
			hlobj.color=obj.color;
			hlobj.display_mode=UI.HL_DISPLAY_MODE_EMBOLDEN
			hlobj.invertible=0;
			obj.m_clickable_ranges.push({
				loc0:loc0,
				loc1:loc1,
				hlobj:hlobj,
				f:fclick_callback})
		}
		ccnt_lh=ccnt_next;
		line++;
	}
	UI.Refresh()
}

W.SXS_BuildOutput=function(id,attrs){
	var obj=UI.Keep(id,attrs);
	UI.StdStyling(id,obj,attrs, "sxs_build_output",(obj.doc&&UI.HasFocus(obj.doc))?"focus":"blur");
	UI.StdAnchoring(id,obj);
	UI.Begin(obj)
		UI.RoundRect(obj)
		if(UI.g_build_output_editor){
			obj.doc=UI.g_build_output_editor;
			W.Edit("doc",{
				'anchor':'parent','anchor_align':"fill",'anchor_valign':"fill",
				'x':4,'y':4,
			})
		}
	UI.End()
	return obj
}

UI.CallPMJS=function(cmd,desc, doc,fparse, fcallback_completion){
	//redirect and parse the output
	var args
	if(desc.is_jc_call){
		//call jc
		args=["jc"].concat(desc.args)
	}else{
		desc.delete_json_file=1
		if(cmd=="run"){
			desc.pause_after_run=1
		}
		var fn_json=IO.GetNewDocumentName("pmjs","json","temp")
		IO.CreateFile(fn_json,JSON.stringify(desc))
		//IO.AsyncShell(["pmjs",cmd,fn_json])
		UI.got_any_error_this_run=0
		args=["pmjs",cmd,fn_json]
	}
	if(cmd=="run"){
		IO.RunProcess(args,UI.GetPathFromFilename(doc.m_file_name),1)
		if(fcallback_completion){fcallback_completion()}
		return
	}
	var proc=IO.RunToolRedirected(args,UI.GetPathFromFilename(doc.m_file_name),0)
	if(proc){
		var fpoll=function(){
			var s=proc.Read(65536)
			//print('fpoll',cmd,!s,proc.IsRunning())
			if(s){
				UI.WriteBuildOutput(fparse,s)
				UI.NextTick(fpoll)
			}else if(proc.IsRunning()){
				UI.setTimeout(fpoll,100)
			}else{
				var code=proc.GetExitCode()
				if(code!=0&&!UI.got_any_error_this_run){
					UI.WriteBuildOutput(fparse,doc.m_file_name+":1:1: fatal error: build failed somehow\n")
				}
				if(cmd=="make"){
					UI.WriteBuildOutput(function(){},code==0?"===== Build completed =====\n":"===== Build FAILED =====\n")
				}else if(cmd=="run"){
					UI.WriteBuildOutput(function(){},"===== Program terminated =====\n")
				}
				if(fcallback_completion){
					fcallback_completion(code)
				}else{
					UI.WriteBuildOutput(function(){},"\n")
				}
			}
		}
		UI.NextTick(fpoll)
	}else{
		UI.WriteBuildOutput(fparse,doc.m_file_name+":1:1: fatal error: unable to invoke the compiler\n")
	}
}

var g_re_errors=new RegExp("^error_.*$")
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.m_error_overlays=[]
	this.PushError=function(err){
		var go_prev_line=0
		if(!err.line1){
			err.line1=err.line0
		}
		if(!err.col0){
			err.col0=0;
			err.col1=0;
			if(err.line0==err.line1){
				err.line1++
				go_prev_line=1
			}
		}else if(!err.col1){
			err.col1=err.col0;
		}
		if(err.col0==err.col1&&err.line0==err.line1){
			err.col1++;
		}
		err.ccnt0=this.SeekLC(err.line0,err.col0)
		err.ccnt1=this.SeekLC(err.line1,err.col1)
		if(go_prev_line&&err.ccnt1>err.ccnt0){err.ccnt1--}
		var hl_items=this.CreateTransientHighlight({
			'depth':1,
			'color':err.color||this.color_tilde_compiler_error,
			'display_mode':UI.HL_DISPLAY_MODE_TILDE,
			'invertible':0,
		});
		hl_items[0].ccnt=err.ccnt0;err.ccnt0=hl_items[0];hl_items[0].undo_tracked=1
		hl_items[1].ccnt=err.ccnt1;err.ccnt1=hl_items[1];hl_items[1].undo_tracked=1
		err.highlight=hl_items[2];
		err.id=this.m_error_overlays.length
		err.is_ready=1
		////////////
		this.m_error_overlays.push(err)
	}
	this.AddEventHandler('menu',function(){
		var ed=this.ed;
		var sel=this.GetSelection()
		this.owner.DismissNotificationsByRegexp(g_re_errors)
		if(sel[0]==sel[1]){
			var error_overlays=this.m_error_overlays
			if(error_overlays&&error_overlays.length){
				var ccnt=sel[0]
				for(var i=0;i<error_overlays.length;i++){
					var err=error_overlays[i]
					if(ccnt>=err.ccnt0.ccnt&&ccnt<=err.ccnt1.ccnt){
						var color=(err.color||this.color_tilde_compiler_error)
						this.owner.CreateNotification({
							id:"error_"+err.id.toString(),icon:'警',
							text:err.message,
							icon_color:color,
							//text_color:color,
							color:UI.lerp_rgba(color,0xffffffff,0.95),
						},"quiet")
					}
				}
			}
		}
		return 0;
	})
}).prototype.name="Error overlays";

UI.ClearCompilerErrors=function(){
	//keep the locators for seeking but remove the highlights
	for(var i=0;i<UI.g_all_document_windows.length;i++){
		var obj=UI.g_all_document_windows[i].doc
		if(obj&&obj.doc&&obj.doc.m_error_overlays){
			for(var j=0;j<obj.doc.m_error_overlays.length;j++){
				var err_j=obj.doc.m_error_overlays[j]
				if(err_j.highlight){err_j.highlight.discard()}
			}
			obj.doc.m_error_overlays=[]
		}
	}
}

UI.CreateCompilerError=function(err){
	UI.OpenEditorWindow(err.file_name,function(){
		if(this.m_error_overlays){
			this.PushError(err)
		}
	})
	return function(do_onfocus,raw_edit_ccnt0,raw_edit_ccnt1){
		if(!err.is_ready){return;}
		UI.OpenEditorWindow(err.file_name,function(){
			this.SetSelection(err.ccnt0.ccnt,err.ccnt1.ccnt)
			this.CallOnSelectionChange();
			if(do_onfocus){
				UI.SetFocus(this)
			}
		})
	}
}

///////////////////////
//todo: forward / inverse seek
UI.RegisterCodeEditorPersistentMember("m_latex_sync")
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.m_latex_sync=1;
});
Language.RegisterCompiler(["tex"],{
	name:"pdftexify",
	GetDesc:function(doc){
		return {
			Platform_BUILD:["release"],
			Platform_ARCH:[UI.Platform.ARCH],
			include_js:["make_tex.js"],
			input_files:[doc.m_file_name],
			m_latex_sync:doc.m_latex_sync,
			m_editor_exe:IO.m_my_name,
			m_line:doc.GetLC(doc.sel1.ccnt)[0]+1,
		}
	},
	m_regex:new RegExp('^(.*?):([0-9]+): (.+)\r?\n'),
	ParseOutput:function(sline){
		var matches=sline.match(this.m_regex)
		if(matches){
			var name=matches[1]
			var linea=parseInt(matches[2])
			var message=matches[3]
			var err={
				file_name:name,
				color:this.color_tilde_compiler_error,
				message:message,line0:linea-1,
			}
			//another plugin for error overlay
			return UI.CreateCompilerError(err)
		}
	},
})

///////////////////////
UI.RegisterCodeEditorPersistentMember("m_cflags")
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.m_cflags={
		build:"debug",
		arch:UI.Platform.ARCH,
	};
	//coulddo: true cflags
});
Language.RegisterCompiler(["c","cpp","cxx","cc"],{
	name:"cc",
	GetDesc:function(doc){
		var ret={
			Platform_BUILD:[(doc.m_cflags?doc.m_cflags.build:undefined)||"debug"],
			Platform_ARCH:[(doc.m_cflags?doc.m_cflags.arch:undefined)||UI.Platform.ARCH],
			c_files:[doc.m_file_name],
			h_files:[],
			input_files:[doc.m_file_name],
		}
		return ret
	},
	m_regex_cc:new RegExp('^(.*?):([0-9]+):(([0-9]+):)? ((error)|(warning): )?(.*?)\r?\n'),
	m_regex_vc:new RegExp('^[ \t]*(.*?)[ \t]*\\(([0-9]+)\\)[ \t]*:?[ \t]*(fatal )?((error)|(warning))[ \t]+C[0-9][0-9][0-9][0-9][ \t]*:[ \t]*(.*?)\r?\n'),
	ParseOutput:function(sline){
		var matches=sline.match(this.m_regex_vc)
		if(matches){
			var name=matches[1]
			var linea=parseInt(matches[2])
			var message=matches[7]
			var category=matches[4]
			var err={
				file_name:name,
				color:category=='error'?this.color_tilde_compiler_error:this.color_tilde_compiler_warning,
				message:message,line0:linea-1,
			}
			return UI.CreateCompilerError(err)
		}
		matches=sline.match(this.m_regex_cc)
		if(matches){
			var name=matches[1]
			var linea=parseInt(matches[2])
			var message=matches[8]
			var category=(matches[5]?matches[5].toLowerCase():"error")
			//for(var i=0;i<matches.length;i++){
			//	print(i,matches[i])
			//}
			var err={
				file_name:name,
				color:category=='error'?this.color_tilde_compiler_error:this.color_tilde_compiler_warning,
				message:message,line0:linea-1
			}
			if(matches[4]){
				err.col0=parseInt(matches[4])-1
			}
			return UI.CreateCompilerError(err)
		}
	},
})

/////////////////////////////////////////////
Language.RegisterCompiler(["jc"],{
	name:"jacy",
	m_regex_cc:new RegExp('^(.*?):([0-9]+):(([0-9]+):)? ((error)|(warning): )?(.*?)\r?\n'),
	m_regex_vc:new RegExp('^[ \t]*(.*?)[ \t]*\\(([0-9]+)\\)[ \t]*:?[ \t]*(fatal )?((error)|(warning))[ \t]+C[0-9][0-9][0-9][0-9][ \t]*:[ \t]*(.*?)\r?\n'),
	ParseOutput:function(sline){
		var matches=sline.match(this.m_regex_vc)
		if(matches){
			var name=matches[1]
			var linea=parseInt(matches[2])
			var message=matches[7]
			var category=matches[4]
			var err={
				file_name:name,
				color:category=='error'?this.color_tilde_compiler_error:this.color_tilde_compiler_warning,
				message:message,line0:linea-1,
			}
			return UI.CreateCompilerError(err)
		}
		matches=sline.match(this.m_regex_cc)
		if(matches){
			var name=matches[1]
			var linea=parseInt(matches[2])
			var message=matches[8]
			var category=(matches[5]?matches[5].toLowerCase():"error")
			//for(var i=0;i<matches.length;i++){
			//	print(i,matches[i])
			//}
			var err={
				file_name:name,
				color:category=='error'?this.color_tilde_compiler_error:this.color_tilde_compiler_warning,
				message:message,line0:linea-1
			}
			if(matches[4]){
				err.col0=parseInt(matches[4])-1
			}
			return UI.CreateCompilerError(err)
		}
	},
	make:function(doc,run_it){
		var args=[]
		if(doc.m_cflags){
			args.push("--build="+doc.m_cflags.build)
			args.push("--arch="+doc.m_cflags.arch)
		}
		args.push(doc.m_file_name)
		if(run_it){
			args.push("--run")
		}
		UI.CallPMJS("make",{
			is_jc_call:1,
			args:args,
		}, doc,this.ParseOutput.bind(this),undefined)
	}
})

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
}).prototype.name="New-line indentation";

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)&&UI.SDL_HasClipboardText()){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			var menu_edit_children=menu_edit.$
			var bk_children=menu_edit_children.slice(menu_edit.p_paste,menu_edit_children.length)
			menu_edit.$=menu_edit_children.slice(0,menu_edit.p_paste)
			menu_edit.AddNormalItem({text:"Smart paste",icon:"粘",enable_hotkey:1,key:"SHIFT+CTRL+V",action:function(){
				var sel=this.GetSelection();
				var ed=this.ed;
				/*
				indent handling
				line head: nothing/less (tell from the last line), good
					if it's nothing / less, compensate to the correct ind first: move last line to first
				match minimal indent with current line
					ignore paste location as long as it's inside the indent
				*/
				var ccnt_corrected=ed.MoveToBoundary(sel[1],1,"space");
				if(sel[1]>sel[0]&&ed.MoveToBoundary(sel[0],-1,"space")<sel[0]){
					//line overwrite mode, use sel[0]
					ccnt_corrected=sel[0];
				}else if(ed.GetUtf8CharNeighborhood(ccnt_corrected)[1]==10){
					var ccnt_lh=this.SeekLC(this.GetLC(ccnt_corrected)[0],0)
					if(ed.MoveToBoundary(ccnt_lh,1,"space")==ccnt_corrected){
						//empty line: simply paste before this line, do nothing
					}else{
						//paste to the next line if called on at eoln
						ccnt_corrected++;
						ccnt_corrected=ed.MoveToBoundary(ccnt_corrected,1,"space")
					}
				}else{
					ccnt_corrected=sel[0];
				}
				var ccnt_lh=this.SeekLC(this.GetLC(ccnt_corrected)[0],0)
				var s_target_indent=ed.GetText(ccnt_lh,ccnt_corrected-ccnt_lh)
				var sinsert=UI.ED_GetClipboardTextSmart(s_target_indent)
				var ccnt_new=ccnt_lh;
				if(ccnt_lh<=sel[0]){
					this.HookedEdit([ccnt_lh,0,sinsert,sel[0],sel[1]-sel[0],undefined])
				}else{
					this.HookedEdit([sel[0],sel[1]-sel[0],undefined,ccnt_lh,0,sinsert])
					ccnt_new-=(sel[1]-sel[0])
				}
				this.CallOnChange()
				ccnt_new=ed.MoveToBoundary(ccnt_new+Duktape.__byte_length(sinsert),1,"space")
				this.SetCaretTo(ccnt_new)
				UI.Refresh()
			}.bind(this)})
			menu_edit.$=menu_edit.$.concat(bk_children)
		}
	})
}).prototype.name="Smart paste";

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
		}
	})
}).prototype.name="Line / word deletion";

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	var fcomment=function(){
		var lang=this.plugin_language_desc
		var ed=this.ed;
		var sel=this.GetSelection();
		var line0=this.GetLC(sel[0])[0];
		var line1=this.GetLC(sel[1])[0];
		if((line0==line1&&sel[0]<sel[1]||!lang.line_comment)&&lang.paired_comment){
			var s0=lang.paired_comment[0]
			var s1=lang.paired_comment[1]
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
		if(!lang.line_comment){
			return 1
		}
		if(this.SeekLC(line1,0)<sel[1]){line1++;}
		var line_ccnts=this.SeekAllLinesBetween(line0,line1+1);
		var ops=[];
		var is_decomment=1
		var s0=lang.line_comment
		var lg0=Duktape.__byte_length(s0)
		var min_n_spaces=undefined;
		for(var i=0;i<line_ccnts.length-1;i++){
			var ccnt0=line_ccnts[i];
			var ccnt_eh=ed.MoveToBoundary(ccnt0,1,"space")
			if(min_n_spaces==undefined||min_n_spaces>(ccnt_eh-ccnt0)){
				min_n_spaces=ccnt_eh-ccnt0;
			}
			ccnt_eh=Math.min(ccnt_eh,ccnt0+min_n_spaces);
			line_ccnts[i]=ccnt_eh
			if(is_decomment&&ed.GetText(ccnt_eh,lg0)!=s0){
				is_decomment=0
			}
		}
		for(var i=0;i<line_ccnts.length-1;i++){
			var ccnt0=line_ccnts[i];
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
			var obj=this
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({icon:"释",text:"Toggle c&omment",enable_hotkey:1,key:"CTRL+K",action:function(){
				fcomment.call(obj)
			}})
		}
	})
}).prototype.name="Comment / uncomment";

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
				ops.push(ccnt0,0,'\t')
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
				this.AddEventHandler('TAB',function(){
					return indentText.call(this,1)
				})
				this.AddEventHandler('SHIFT+TAB',function(){
					return indentText.call(this,-1)
				})
			}
		}
	})
}).prototype.name="Tab indent/dedent"

UI.RegisterEditorPlugin(function(){
	//alt+pgup/pgdn
	if(this.plugin_class!="code_editor"){return;}
	this.m_outer_scope_queue=[]
	var fouter_scope=function(){
		var ed=this.ed;
		var ccnt_new=this.FindOuterLevel(this.sel1.ccnt);
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
}).prototype.name="Scope-related cursor movement";

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
}).prototype.name="Keyboard scrolling";

//bookmarking
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
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
	this.AddEventHandler('SHIFT+CTRL+Q',function(){
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
	});
	//todo: menu
}).prototype.name="Bookmarks";

//point of interest
UI.RegisterEditorPlugin(function(){
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
				var ccnt_err0=err.ccnt0.ccnt;
				var ccnt_err1=err.ccnt1.ccnt;
				if(ccnt_err0<=ccnt&&ccnt<=ccnt_err1){continue;}
				propose(ccnt_err0);
			}
		}
		//spell error
		//todo: native searcher - call colorer, find word, test color, spell check
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
			menu_search.AddButtonRow({text:"Go to point of interest"},[
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
}).prototype.name="Point of interest";

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
}).prototype.name="Parenthesis matching";

var CountSpacesAfter=function(ed,ccnt){
	return ed.MoveToBoundary(ccnt,1,"space")-ccnt;
}

UI.RegisterEditorPlugin(function(){
	//bracket-related auto-indent
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('RETURN RETURN2',function(){
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
		if(this.sel0.ccnt!=this.sel1.ccnt){return 1;}
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
					snewline=snewline+ed.GetText(ccnt_lh,nspaces)+"\t"
				}else{
					snewline=snewline+ed.GetText(ccnt_nextline,nspaces)
				}
			}else{
				//add extra indent
				var nspaces=CountSpacesAfter(ed,ccnt_lh)
				snewline=snewline+ed.GetText(ccnt_lh,nspaces)+"\t"
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
				snewline="{"+snewline+"\t"+snewline+"}"
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
		(function(C){
			this.AddEventHandler(C,function(){return f_key_test.call(this,C)})
		}).call(this,C);
	}
}).prototype.name="Auto-indent";

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
		if(C=="{"||C=="["||C=="("||((C=="'"&&!lang.is_tex_like||C=='$'&&lang.is_tex_like||C=="\"")&&C!=ctx.current_bracket_ac)){
			var chbraac=MatchingBracket(C)
			var ccnt_pos=this.sel1.ccnt
			var ch_neibs=ed.GetUtf8CharNeighborhood(ccnt_pos)
			var chprev=ch_neibs[0]
			var chnext=ch_neibs[1]
			if(chbraac){
				if(this.IsLeftBracket(String.fromCharCode(C))&&chbraac!="'"&&chbraac!="\""&&chbraac!="$"){
					//the syntax has to actually consider it as a bracket, or it has to be a quote
					chbraac=0;
				}else if(!this.IsBracketEnabledAt(ccnt_pos)){
					//the state has to allow brackets
					chbraac=0
				}else if(chbraac=='}'&&!lang.curly_bracket_is_not_special){
					//{ before indented line
					var indent_cur_line=this.GetIndentLevel(ccnt_pos);
					var lineno=this.GetLC(ccnt_pos)[0]
					var ccnt_lh_next=this.SeekLC(lineno+1,0)
					var indent_next_line=this.GetIndentLevel(ed.MoveToBoundary(ccnt_lh_next,1,"space"));
					if(indent_cur_line<indent_next_line){
						chbraac=0;
					}
				}else if(C==chbraac&&chprev==C.charCodeAt(0)){
					//type two quotes in the middle of a string, do not AC
					chbraac=0;
				}
			}
			if(chbraac==C){
				//for self-matching things, we need to take space/non-space neighbors as a hint
				//do not auto-match when the next char is a word-char
				//also deny ' in tex when the *previous* char is a word-char
				if(UI.IsWordChar(chnext)||UI.IsWordChar(chprev)){
					chbraac=0;
				}
			}
			if(chbraac){
				//other-half-mismatch test
				var is_lineend=this.IsLineEndAt(ccnt_pos)
				var is_manual_match=0
				if(ctx.bac_stack.length){
					//only the topmost level should check for the match
					is_manual_match=0
				}else if(chbraac=='}'&&!lang.indent_as_parenthesis){
					is_manual_match=0;
				}else{
					var blevel=this.GetBracketLevel(ccnt_pos)
					var ccnt_rbra=this.FindBracket(blevel-1,ccnt_pos,1)
					is_manual_match=(ccnt_rbra>=0&&ed.GetUtf8CharNeighborhood(ccnt_rbra)[1]==chbraac)
				}
				//smarter auto (): clearly fcall-ish case
				var ccnt_next_nonspace=ed.MoveToBoundary(ccnt_pos,1,"space")
				var chnext_nonspace=String.fromCharCode(ed.GetUtf8CharNeighborhood(ccnt_next_nonspace)[1])
				var is_fcall_like=0
				//([{
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
				if((is_lineend||chbraac==C&&!UI.IsWordChar(chnext)&&!UI.IsWordChar(chprev))&&!is_manual_match||ctx.current_bracket_ac_ccnt_range&&ccnt_pos+1==ctx.current_bracket_ac_ccnt_range[1].ccnt||is_fcall_like){
					if(ctx.current_bracket_ac){
						ctx.bac_stack.push(ctx.current_bracket_ac_ccnt_range)
						ctx.bac_stack.push(ctx.current_bracket_ac_bralevel)
						ctx.bac_stack.push(ctx.current_bracket_ac)
					}
					//.just_typed_bra=0//for func hint purposes
					var str=C+chbraac;
					var sel=this.GetSelection()
					ctx.current_bracket_ac=chbraac
					ccnt_pos=sel[0]
					if(lang.is_tex_like){
						//\left completion
						if(C=="{"){
							if(ccnt_pos>=1&&ed.GetText(ccnt_pos-1,1)=="\\"){
								str=C+"\\"+chbraac;
							}
							if(ccnt_pos>=6&&ed.GetText(ccnt_pos-6,6)=="\\left\\"){
								str=C+"\\right\\"+chbraac
							}
						}else{
							if(ccnt_pos>=5&&ed.GetText(ccnt_pos-5,5)=="\\left"){
								str=C+"\\right"+chbraac
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
					this.m_user_just_typed_char=1
					return 0
				}
			}
			return 1
		}
		if(C==ctx.current_bracket_ac){
			var ccnt1=this.sel1.ccnt
			if(ccnt1+Duktape.__byte_length(C)==ctx.current_bracket_ac_ccnt_range[1].ccnt&&this.sel0.ccnt==ccnt1){
				this.HookedEdit([ccnt1,Duktape.__byte_length(C),C])
				this.CallOnChange()
				this.SetCaretTo(ccnt1+Duktape.__byte_length(C))
				this.CallOnSelectionChange()
				this.m_user_just_typed_char=1
				ctx.PopBacStack()
				return 0
			}
			return 1
		}
		return 1
	}
	var listening_keys=["{","[","(","'","\"","$",")","]","}"]
	for(var i=0;i<listening_keys.length;i++){
		var C=listening_keys[i];
		(function(C){
			this.AddEventHandler(C,function(){return f_key_test.call(this,C)})
		}).call(this,C);
	}
}).prototype.name="Bracket completion";

//ignoring trailing spaces
UI.RegisterEditorPlugin(function(){
	this.AddEventHandler('END',function(){
		var ed_caret=this.GetCaretXY();
		var ccnt_lend=this.SeekXY(1e17,ed_caret.y);
		var ccnt_reend=this.GetEnhancedEnd(ccnt_lend)
		if(ccnt_reend<ccnt_lend&&this.sel1.ccnt!=ccnt_reend){
			//auto-strip the trailing space
			ccnt_lend=this.SeekLC(this.GetLC(ccnt_reend)[0],1e17)
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
}).prototype.name="Auto-strip trailing spaces";

//hiding
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)&&!this.hyphenator){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({text:"Fo&ld",icon:"叠",enable_hotkey:1,key:"ALT+LEFT",action:function(){
				var ed=this.ed;
				var sel=this.GetSelection();
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				if(sel[0]==sel[1]){
					//bracket: end, ctrl+p
					//do bracket if possible
					var ccnt=sel[0]
					var line=this.GetLC(ccnt)[0]
					var ccnt_l0=this.SeekLC(line,0)
					var ccnt_outer0=this.FindOuterBracket_SizeFriendly(ccnt,-1)
					var range=undefined
					if(ccnt_outer0>=ccnt_l0){
						//found bracket on the line
						var ccnt_outer1=this.FindOuterBracket_SizeFriendly(ccnt,1)
						if(ccnt_outer1>ccnt_outer0){
							range=[ccnt_outer0+this.BracketSizeAt(ccnt_outer0,0),ccnt_outer1-this.BracketSizeAt(ccnt_outer1,1)]
						}
					}else{
						var id_indent=ed.m_handler_registration["seeker_indentation"]
						var my_level=this.GetIndentLevel(this.ed.MoveToBoundary(ccnt,1,"space"));
						var ccnt_l1=this.SeekLC(line+1)
						var ccnt_new=ed.FindNearest(id_indent,[my_level],"l",ccnt_l1,1);
						if(ccnt_new>ccnt_l1){
							ccnt_new=this.SeekLC(this.GetLC(ccnt_new)[0],0)-1
							if(ccnt_new>ccnt_l1){
								if(this.IsRightBracketAt(ccnt_new+1)){
									ccnt_new++
								}
								range=[ccnt_l1,ccnt_new]
							}
						}
					}
					sel=range
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
			menu_edit.AddNormalItem({text:"U&nfold",icon:"展",enable_hotkey:1,key:"ALT+RIGHT",action:function(){
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
		}
	})
	this.AddEventHandler('selectionChange',function(){
		var sel=this.GetSelection();
		var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		renderer.ShowRange(this.ed,sel[0]+1,sel[0]-1)
		renderer.ShowRange(this.ed,sel[1]+1,sel[1]-1)
	})
}).prototype.name="Text hiding";

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

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			if(sel[0]<sel[1]){
				menu_edit.AddSeparator()
				menu_edit.AddNormalItem({text:"Wide char ↔ \\u",icon:"Ｕ",enable_hotkey:1,key:"SHIFT+CTRL+U",action:function(){
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
		}
	})
}).prototype.name="Unicode conversion";

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.owner){return;}
	this.AddEventHandler('menu',function(){
		if(UI.HasFocus(this)){
			var sel=this.GetSelection();
			var menu_edit=UI.BigMenu("&Edit")
			menu_edit.AddSeparator()
			menu_edit.AddNormalItem({
					text:"Auto &wrap",
					icon:this.owner.m_enable_wrapping?"对":undefined,
					enable_hotkey:1,key:"SHIFT+CTRL+W",
					action:function(){
				this.owner.m_enable_wrapping=(this.owner.m_enable_wrapping?0:1)
				var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
				var ed_caret_original=this.GetCaretXY();
				var scroll_y_original=this.scroll_y;
				renderer.ResetWrapping(this.owner.m_enable_wrapping?this.owner.m_current_wrap_width:0,this)
				this.caret_is_wrapped=0
				this.ed.InvalidateStates([0,this.ed.GetTextSize()])
				var ed_caret_new=this.GetCaretXY();
				this.scroll_y=scroll_y_original-ed_caret_original.y+ed_caret_new.y;
				this.AutoScroll("show")
				this.scrolling_animation=undefined
				UI.Refresh()
			}.bind(this)})
		}
	})
	//this.AddEventHandler('load',function(){
	//	var renderer=this.ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
	//	//print(this.owner.file_name,this.owner.m_enable_wrapping)
	//	renderer.ResetWrapping(this.owner.m_enable_wrapping?this.owner.m_current_wrap_width:0)
	//	this.ed.InvalidateStates([0,this.ed.GetTextSize()])
	//})
}).prototype.name="Wrapping";

var ApplyAutoEdit=function(obj,cur_autoedit_ops,line_id){
	var locs=obj.m_autoedit_locators;
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
		obj.SetSelection(ccnt,ccnt)
		obj.HookedEdit(ops_now);
		var s=ops_now[ops_now.length-1]
		if(s){
			var ccnt=obj.GetSelection()[0]
			obj.SetSelection(ccnt,ccnt+Duktape.__byte_length(s))
		}
	}
	//removed the processed edit ops
	return ret
}

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"){return;}
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
	}
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
		//still-in-range test
		if(this.m_autoedit_locators){
			var locs=this.m_autoedit_locators
			if(this.m_autoedit_mode=="explicit"){
				//if(ccnt_lh>=locs[0].ccnt&&ccnt_lh<locs[locs.length-1].ccnt)
				//if(ccnt_lh==locs[0].ccnt){
				//	return;
				//}
				return;
			}else if(this.m_autoedit_example_line_id>=0){
				var line_id=this.m_autoedit_example_line_id;
				//if(ccnt_lh>=locs[line_id+0].ccnt&&ccnt_lh<locs[line_id+1].ccnt)
				if(ccnt_lh==locs[line_id+0].ccnt){
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
			this.m_do_not_detect_autoedit_at=undefined
		}
		//could allow multi-exampling this
		InvalidateAutoEdit.call(this)
	})
	this.AddEventHandler('beforeEdit',function(ops){
		this.m_autoedit_example_line_id=-1
		var ctx=this.m_autoedit_context
		if(!ctx&&this.m_detect_autoedit_at!=undefined){
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
				this.m_do_not_detect_autoedit_at=this.GetLC(this.m_detect_autoedit_at)[0];
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
		if(!UI.ED_AutoEdit_SetExample(ctx,line_id>>1,ed.GetText(locs[line_id].ccnt,locs[line_id+1].ccnt-locs[line_id].ccnt))){
			return 1;
		}
		var ops=UI.ED_AutoEdit_Evaluate(ctx,locs)
		//for(var i=0;i<locs.length;i+=2){
		//	print("============",i/2)
		//	print(ed.GetText(locs[i+0].ccnt,locs[i+1].ccnt-locs[i+0].ccnt))
		//}
		//print(ops)
		//highlight ops - fill out the overlay system
		var renderer=ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		renderer.m_tentative_editops=ops
		renderer.ResetTentativeOps()
		UI.Refresh()
		return 1;
	})
	//CTRL+D - return 1, the other end should be a hook...? just compete and adjust the priority
	this.AddEventHandler('menu',function(){
		var ed=this.ed
		var renderer=ed.GetHandlerByID(this.ed.m_handler_registration["renderer"]);
		if(renderer.m_tentative_editops){
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
			var menu_edit=UI.BigMenu("&Edit")
			var this_outer=this;
			menu_edit.AddSeparator()
			menu_edit.AddButtonRow({text:"Replace"},[
				{key:"SHIFT+CTRL+D",text:"prev",tooltip:'SHIFT+CTRL+D',action:function(){
					if(line_id>0){
						renderer.m_tentative_editops=ApplyAutoEdit(this_outer,cur_autoedit_ops,line_id-2)
						renderer.ResetTentativeOps()
					}
				}},{key:"CTRL+D",text:"next",tooltip:'CTRL+D',action:function(){
					if(line_id+2<locs.length){
						renderer.m_tentative_editops=ApplyAutoEdit(this_outer,cur_autoedit_ops,line_id+2)
						renderer.ResetTentativeOps()
					}
				}},{key:"ALT+A",text:"all",tooltip:'ALT+A',action:function(){
					if(cur_autoedit_ops.length>0){
						var ccnt=cur_autoedit_ops[cur_autoedit_ops.length-3]
						this_outer.SetSelection(ccnt,ccnt)
					}
					this_outer.HookedEdit(cur_autoedit_ops);
					if(cur_autoedit_ops.length>0){
						var s=cur_autoedit_ops[cur_autoedit_ops.length-1]
						if(s){
							var ccnt=this_outer.GetSelection()[0]
							this_outer.SetSelection(ccnt,ccnt+Duktape.__byte_length(s))
						}
					}
					renderer.m_tentative_editops=undefined
					renderer.ResetTentativeOps()
					var tmp=this_outer.m_autoedit_example_line_id;
					this_outer.m_autoedit_example_line_id=-1;
					this_outer.CallOnChange()
					this_outer.m_autoedit_example_line_id=tmp;
					InvalidateAutoEdit.call(this_outer)
				}}])
			
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
		this.is_in_vsel=1
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
		if(ctx){
			StartAutoEdit.call(this,ctx.m_cclines,"explicit")
		}
	}).bind(this)
	this.AddEventHandler('selectionChange',function(){
		if(this.vsel_skip_sel_change){this.vsel_skip_sel_change=0;return 1;}
		if(!this.is_in_vsel){return 1;}//return 1 for "don't intercept"
		//leave vsel
		this.is_in_vsel=0
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
}).prototype.name="Auto-edit";

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
		q1.push({file_name:this.owner.file_name,ccnt0:prev_ccnt0,ccnt1:prev_ccnt1,sreason:"navigation"})
		UI.g_cursor_history_test_same_reason=0
		UI.OpenEditorWindow(navitem.file_name,function(){
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
				{text:"back",tooltip:"CTRL+ALT+'-'",action:function(){
					fprevhist.call(doc)
				}},{text:"forward",tooltip:"CTRL+ALT+'+'",action:function(){
					//text:"&select to"
					fnexthist.call(doc)
				}}])
		}
	})
}).prototype.name="Cursor history";

/*
var g_regexp_bash_escaping=new RegExp('[#;&"\'\\\\,`:!*?$(){}\\[\\]<|> \t]','g');
UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('TAB',function(){
		//shell script
		var lang=this.plugin_language_desc
		if(!lang||!lang.shell_script_type){return 1;}
		//no selection
		if(this.sel0.ccnt!=this.sel1.ccnt){return 1;}
		//cursor at end of line
		var ccnt_end=this.ed.MoveToBoundary(this.sel1.ccnt,1,"space");
		if(this.ed.GetUtf8CharNeighborhood(ccnt_end)[1]!=10){return 1;}
		//line short enough
		var ccnt_lh=this.SeekLC(this.GetLC(this.sel1.ccnt)[0],0)
		if(!(this.sel1.ccnt-ccnt_lh<4096)){return 1;}
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
		if(args.length<3){return 1;}
		//work on args
		var s_path=args[args.length-3];
		var find_context=IO.CreateEnumFileContext(s_path.replace(g_regexp_backslash,"/")+"*",3)
		var s_common=undefined
		for(;;){
			var fnext=find_context()
			if(!fnext){
				find_context=undefined
				break
			}
			var sname=fnext.name
			if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
				sname=sname.toLowerCase()
			}
			if(fnext.is_dir){
				sname=sname+"/"
			}
			if(!s_common){
				s_common=sname
			}else{
				for(var i=0;i<s_common.length;i++){
					if(i>=sname.length||sname[i]!=s_common[i]){
						s_common=s_common.substr(0,i)
						break;
					}
				}
			}
			if(s_common.length<=s_path.length){break;}
		}
		if(!s_common||s_common.length<=s_path.length){return 1;}
		//actually replace the stuff
		if(lang.shell_script_type=="windows"){
			s_common=s_common.replace(g_regexp_slash,"\\")
			if(s_common.indexOf(' ')>=0||s_common.indexOf('\t')>=0){
				//quote it
				s_common='"'+s_common+'"';
			}
		}else{
			//unix, escape the stuff
			var fescapestuff=UI.HackCallback(function(smatch){
				return "\\"+smatch;
			});
			s_common=s_common.replace(g_regexp_bash_escaping,fescapestuff);
		}
		var ccnt0=ccnt_lh+Duktape.__byte_length(s.slice(0,args[args.length-2]))
		var ccnt1=ccnt_lh+Duktape.__byte_length(s.slice(0,args[args.length-1]))
		this.HookedEdit([ccnt0,ccnt1-ccnt0,s_common])
		this.CallOnChange()
		this.SetCaretTo(ccnt0+Duktape.__byte_length(s_common))
		return 0
	})
}).prototype.name="File name completion";
*/

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('change',function(){
		if(!this.m_diff_from_save||!this.owner||!(this.owner.h_obj_area>0)){return;}
		this.m_diff_minimap=UI.ED_CreateDiffTrackerBitmap(this.ed,this.m_diff_from_save,this.owner.h_obj_area*UI.pixels_per_unit);
		this.m_diff_minimap_h_obj_area=this.owner.h_obj_area
	})
}).prototype.name="Diff minimap";

UI.RegisterEditorPlugin(function(){
	if(this.plugin_class!="code_editor"||!this.m_is_main_editor){return;}
	this.AddEventHandler('menu',function(){
		var menu_lang=UI.BigMenu("&Language")
		var langs=Language.m_all_languages
		var got_separator=0
		langs.sort(function(a,b){
			a=(a.name_sort_hack||a.name);
			b=(b.name_sort_hack||b.name);
			return a>b?1:(a<b?-1:0);
		})
		for(var i=0;i<langs.length;i++){
			if(!got_separator&&!langs[i].name_sort_hack){
				menu_lang.AddSeparator()
				got_separator=1
			}
			menu_lang.AddNormalItem({
				text:langs[i].name,
				icon:(this.owner.m_language_id==langs[i].name)?"对":undefined,
				action:function(name){
					this.owner.m_language_id=name;
					//try to reload
					if((this.saved_point||0)!=this.ed.GetUndoQueueLength()||this.ed.saving_context){
						//make a notification
						this.owner.CreateNotification({id:'language_reload_warning',text:"Save the file and reload for the language change to take effect"})
						this.saved_point=-1;
					}else{
						//what is reload? nuke it
						this.owner.Reload()
					}
					UI.Refresh();
				}.bind(this,langs[i].name)})
		}
	})
}).prototype.name="Language selection";
