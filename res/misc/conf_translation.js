// You have to restart QPad for changes to take effect
// Default English UI with simplified Chinese fallback fonts
if(UI.Platform.ARCH=="win32"||UI.Platform.ARCH=="win64"){
	UI.fallback_font_names=["msyh.ttc","arialuni.ttf","simhei.ttf"]
}else if(UI.Platform.ARCH=="mac"){
	UI.fallback_font_names=["STHeiti Medium.ttc","LastResort.ttf"]
}else if(UI.Platform.ARCH=="android"){
	UI.fallback_font_names=["DroidSansFallback.ttf"]
}else if(UI.Platform.ARCH=="linux32"||UI.Platform.ARCH=="linux64"){
	UI.fallback_font_names=["DroidSansFallbackFull.ttf"]
}else{
	UI.fallback_font_names=["res/fonts/dsanscn.ttc"]
}

UI.m_translation={};
