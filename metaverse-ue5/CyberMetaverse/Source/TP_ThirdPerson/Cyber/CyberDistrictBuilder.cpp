#include "Cyber/CyberDistrictBuilder.h"

#include "Components/PointLightComponent.h"
#include "Cyber/CyberCasinoTable.h"
#include "Cyber/CyberPortalActor.h"
#include "Cyber/CyberShopTerminal.h"
#include "Cyber/CyberSpeechPodium.h"
#include "Engine/StaticMeshActor.h"
#include "GameFramework/PlayerStart.h"
#include "Kismet/GameplayStatics.h"

ACyberDistrictBuilder::ACyberDistrictBuilder()
{
	PrimaryActorTick.bCanEverTick = false;
	CubeMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	CylinderMesh = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
}

void ACyberDistrictBuilder::BeginPlay()
{
	Super::BeginPlay();
}

void ACyberDistrictBuilder::BuildDistrict(ECyberDistrict District)
{
	if (bDestroyExistingTemplateActors)
	{
		TArray<AActor*> Existing;
		UGameplayStatics::GetAllActorsOfClass(GetWorld(), AStaticMeshActor::StaticClass(), Existing);
		for (AActor* Actor : Existing)
		{
			if (Actor && !Actor->IsA<APlayerStart>())
			{
				Actor->Destroy();
			}
		}
	}

	switch (District)
	{
	case ECyberDistrict::Plaza:
		BuildPlaza();
		break;
	case ECyberDistrict::Shop:
		BuildShop();
		break;
	case ECyberDistrict::Casino:
		BuildCasino();
		break;
	}
}

AStaticMeshActor* ACyberDistrictBuilder::SpawnBlock(const FVector& Location, const FVector& Scale, const FRotator& Rotation, bool bNeonLight, const FLinearColor& LightColor)
{
	AStaticMeshActor* MeshActor = GetWorld()->SpawnActor<AStaticMeshActor>(Location, Rotation);
	if (!MeshActor)
	{
		return nullptr;
	}

	UStaticMeshComponent* MeshComp = MeshActor->GetStaticMeshComponent();
	MeshComp->SetStaticMesh(CubeMesh);
	MeshComp->SetWorldScale3D(Scale);
	MeshComp->SetMobility(EComponentMobility::Static);
	MeshComp->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);

	if (bNeonLight)
	{
		UPointLightComponent* Neon = NewObject<UPointLightComponent>(MeshActor);
		Neon->AttachToComponent(MeshComp, FAttachmentTransformRules::KeepRelativeTransform);
		Neon->SetRelativeLocation(FVector(0.0f, 0.0f, 120.0f));
		Neon->SetIntensity(7000.0f);
		Neon->SetAttenuationRadius(1400.0f);
		Neon->SetLightColor(LightColor.ToFColor(true));
		Neon->SetMobility(EComponentMobility::Movable);
		Neon->RegisterComponent();
	}

	return MeshActor;
}

void ACyberDistrictBuilder::SpawnPortal(const FVector& Location, const FRotator& Rotation, const FName TargetLevel, const FString& PortalName)
{
	ACyberPortalActor* Portal = GetWorld()->SpawnActor<ACyberPortalActor>(Location, Rotation);
	if (!Portal)
	{
		return;
	}

	Portal->ConfigurePortal(TargetLevel, PortalName);
}

void ACyberDistrictBuilder::BuildPlaza()
{
	// Central arena floor.
	SpawnBlock(FVector(0.0f, 0.0f, -100.0f), FVector(120.0f, 120.0f, 0.8f), FRotator::ZeroRotator, true, FLinearColor(0.0f, 0.85f, 1.0f));

	// Cyber colosseum stands.
	for (int32 Ring = 0; Ring < 4; ++Ring)
	{
		const float Radius = 1800.0f + Ring * 450.0f;
		for (int32 Slice = 0; Slice < 36; ++Slice)
		{
			const float Angle = Slice * 10.0f;
			const float Rad = FMath::DegreesToRadians(Angle);
			const FVector Pos = FVector(FMath::Cos(Rad) * Radius, FMath::Sin(Rad) * Radius, 40.0f + Ring * 120.0f);
			const FRotator Rot = FRotator(0.0f, Angle, 0.0f);
			SpawnBlock(Pos, FVector(1.8f, 3.0f, 0.6f), Rot, Slice % 3 == 0, FLinearColor(1.0f, 0.1f, 0.9f));
		}
	}

	// Hologram towers around the arena.
	for (int32 Index = 0; Index < 10; ++Index)
	{
		const float Angle = Index * 36.0f;
		const float Rad = FMath::DegreesToRadians(Angle);
		const FVector Pos = FVector(FMath::Cos(Rad) * 3800.0f, FMath::Sin(Rad) * 3800.0f, 620.0f);
		SpawnBlock(Pos, FVector(1.4f, 1.4f, 12.0f), FRotator::ZeroRotator, true, FLinearColor(0.2f, 0.6f, 1.0f));
	}

	// Speech podium.
	GetWorld()->SpawnActor<ACyberSpeechPodium>(FVector(0.0f, 0.0f, 120.0f), FRotator::ZeroRotator);

	// Portals.
	SpawnPortal(FVector(900.0f, 0.0f, 120.0f), FRotator(0.0f, 180.0f, 0.0f), TEXT("L_CyberShop"), TEXT("SHOP"));
	SpawnPortal(FVector(-900.0f, 0.0f, 120.0f), FRotator::ZeroRotator, TEXT("L_CyberCasino"), TEXT("CASINO"));
}

void ACyberDistrictBuilder::BuildShop()
{
	SpawnBlock(FVector(0.0f, 0.0f, -100.0f), FVector(90.0f, 70.0f, 0.8f), FRotator::ZeroRotator, true, FLinearColor(1.0f, 0.4f, 0.1f));

	for (int32 Row = -2; Row <= 2; ++Row)
	{
		for (int32 Col = -3; Col <= 3; ++Col)
		{
			if (FMath::Abs(Row) == 2 || FMath::Abs(Col) == 3)
			{
				const FVector Pos = FVector(Row * 1000.0f, Col * 900.0f, 140.0f);
				SpawnBlock(Pos, FVector(2.0f, 1.2f, 2.4f), FRotator::ZeroRotator, true, FLinearColor(1.0f, 0.2f, 0.6f));
			}
		}
	}

	for (int32 Index = 0; Index < 15; ++Index)
	{
		const FVector Pos = FVector(-2000.0f + Index * 280.0f, 0.0f, 120.0f);
		SpawnBlock(Pos, FVector(0.4f, 5.5f, 0.4f), FRotator::ZeroRotator, Index % 2 == 0, FLinearColor(0.1f, 1.0f, 0.9f));
	}

	GetWorld()->SpawnActor<ACyberShopTerminal>(FVector(0.0f, 300.0f, 120.0f), FRotator::ZeroRotator);

	SpawnPortal(FVector(-1200.0f, -900.0f, 120.0f), FRotator(0.0f, 45.0f, 0.0f), TEXT("L_CyberPlaza"), TEXT("PLAZA"));
	SpawnPortal(FVector(1200.0f, 900.0f, 120.0f), FRotator(-0.0f, -135.0f, 0.0f), TEXT("L_CyberCasino"), TEXT("CASINO"));
}

void ACyberDistrictBuilder::BuildCasino()
{
	SpawnBlock(FVector(0.0f, 0.0f, -100.0f), FVector(80.0f, 80.0f, 0.8f), FRotator::ZeroRotator, true, FLinearColor(0.7f, 0.0f, 1.0f));

	for (int32 Index = 0; Index < 24; ++Index)
	{
		const float Angle = Index * 15.0f;
		const float Rad = FMath::DegreesToRadians(Angle);
		const FVector Pos = FVector(FMath::Cos(Rad) * 2600.0f, FMath::Sin(Rad) * 2600.0f, 380.0f);
		SpawnBlock(Pos, FVector(0.9f, 0.9f, 7.0f), FRotator::ZeroRotator, true, FLinearColor(0.0f, 1.0f, 0.8f));
	}

	for (int32 Ring = 0; Ring < 4; ++Ring)
	{
		const float Radius = 600.0f + Ring * 420.0f;
		for (int32 Slice = 0; Slice < 16; ++Slice)
		{
			const float Angle = Slice * 22.5f;
			const float Rad = FMath::DegreesToRadians(Angle);
			const FVector Pos = FVector(FMath::Cos(Rad) * Radius, FMath::Sin(Rad) * Radius, 80.0f + Ring * 40.0f);
			SpawnBlock(Pos, FVector(0.7f, 1.1f, 0.4f), FRotator(0.0f, Angle, 0.0f), Slice % 4 == 0, FLinearColor(1.0f, 0.8f, 0.1f));
		}
	}

	GetWorld()->SpawnActor<ACyberCasinoTable>(FVector(0.0f, 0.0f, 120.0f), FRotator::ZeroRotator);

	SpawnPortal(FVector(-1000.0f, 1200.0f, 120.0f), FRotator(0.0f, 225.0f, 0.0f), TEXT("L_CyberPlaza"), TEXT("PLAZA"));
	SpawnPortal(FVector(1100.0f, -1200.0f, 120.0f), FRotator(0.0f, 45.0f, 0.0f), TEXT("L_CyberShop"), TEXT("SHOP"));
}
