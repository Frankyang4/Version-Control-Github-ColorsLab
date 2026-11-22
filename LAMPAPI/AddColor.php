<?php
	$inData = getRequestInfo();
	
	$color = $inData["color"];
	$userId = $inData["userId"];

	$conn = new mysqli(
		getenv('COLORS_DB_HOST') ?: 'localhost',
		getenv('COLORS_DB_USER') ?: 'TheBeast',
		getenv('COLORS_DB_PASSWORD') ?: 'WeLoveCOP4331',
		getenv('COLORS_DB_NAME') ?: 'COP4331',
		(int)(getenv('COLORS_DB_PORT') ?: 3306)
	);
	if ($conn->connect_error) 
	{
		returnWithError( $conn->connect_error );
	} 
	else
	{
		$stmt = $conn->prepare("INSERT into Colors (UserId,Name) VALUES(?,?)");
		$stmt->bind_param("ss", $userId, $color);
		$stmt->execute();
		$stmt->close();
		$conn->close();
		returnWithError("");
	}

	function getRequestInfo()
	{
		return json_decode(file_get_contents('php://input'), true);
	}

	function sendResultInfoAsJson( $obj )
	{
		header('Content-type: application/json');
		echo $obj;
	}
	
	function returnWithError( $err )
	{
		$retValue = '{"error":"' . $err . '"}';
		sendResultInfoAsJson( $retValue );
	}
	
?>
