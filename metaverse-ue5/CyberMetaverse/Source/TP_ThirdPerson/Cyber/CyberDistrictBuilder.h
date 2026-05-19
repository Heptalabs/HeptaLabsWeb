#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Cyber/CyberGameplayTypes.h"
#include "CyberDistrictBuilder.generated.h"

class AStaticMeshActor;

UCLASS()
class TP_THIRDPERSON_API ACyberDistrictBuilder : public AActor
{
	GENERATED_BODY()

public:
	ACyberDistrictBuilder();

	void BuildDistrict(ECyberDistrict District);

protected:
	virtual void BeginPlay() override;

	void BuildPlaza();
	void BuildShop();
	void BuildCasino();

	AStaticMeshActor* SpawnBlock(const FVector& Location, const FVector& Scale, const FRotator& Rotation, bool bNeonLight, const FLinearColor& LightColor);
	void SpawnPortal(const FVector& Location, const FRotator& Rotation, const FName TargetLevel, const FString& PortalName);

	UStaticMesh* CubeMesh = nullptr;
	UStaticMesh* CylinderMesh = nullptr;

	UPROPERTY(EditAnywhere, Category = "Build")
	bool bDestroyExistingTemplateActors = true;
};
