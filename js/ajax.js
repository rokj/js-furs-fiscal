// sending 
function send_data(url, data, token, handleFun){
    var sd = {data: JSON.stringify(data), csrfmiddlewaretoken: token};

    if (! token) {
        delete sd['csrfmiddlewaretoken'];
    }

    $.ajax({
		type: "POST",
		dataType: "json",
		url: url,
        data: sd,
        timeout: 30000,
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
		success: function(data) {
            if(handleFun) handleFun(data);
        },
        error: function(xhr, textStatus, error){
            console.error("AJAX Error: " + JSON.stringify({
                xhr: xhr, status: textStatus, error: error
            }));
        }
	});
}

// receiving
function get_data(url, handleFun){
	$.ajax({
		type: "GET",
		// dataType: "json",
        timeout: 30000,
        crossDomain: true,
		url: url,
		success: function(data) {
            if(handleFun) handleFun(data);
        },
        error: function(jqXHR, textStatus, error){
            console.error("AJAX Error: " + textStatus + "; " + error);
        }
	});
}